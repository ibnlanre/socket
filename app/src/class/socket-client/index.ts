import type { ConnectionParams } from "@/types/connection-params";
import type { ReconnectExhaustedOptions } from "@/types/reconnect-exhausted-options";
import type { SocketClientConstructor } from "@/types/socket/client-constructor";
import type { UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

import { readSocketSnapshot, Socket } from "@/class/socket";
import { extractOrigin } from "@/functions/extract-origin";
import { getCacheStorage } from "@/functions/get-cache-storage";
import { getUri } from "@/functions/get-uri";
import { isExpired } from "@/functions/is-expired";
import { reconnectExhausted } from "@/functions/reconnect-exhausted";
import { serializeJSON } from "@/functions/serialize-json";
import { socketState } from "@/functions/socket-state";
import { toError } from "@/functions/to-error";
import { schemaValue } from "@/functions/validate-schema";
import { withSignal } from "@/functions/with-signal";

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  ParamsInput = Params,
> {
  #configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>;
  #disposed = false;
  /** Told when a pooled socket's state, or its subscribers, change. */
  #listeners = new Set<() => void>();
  #maxPoolSize: number;
  /** Each pooled socket's watcher, stopped as the socket leaves the pool. */
  #observing = new Map<Socket<Get, Post, Params>, () => void>();
  #pool = new Map<string, Socket<Get, Post, Params>>();
  #resolving = new Map<string, Promise<string>>();
  #swept = false;

  constructor(
    configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>
  ) {
    this.#configuration = configuration;
    this.#maxPoolSize = configuration.maxPoolSize ?? 1000;

    if (!Number.isInteger(this.#maxPoolSize) || this.#maxPoolSize < 1) {
      throw new RangeError("maxPoolSize must be a positive integer.");
    }
  }

  /** Empty the pool and invalidate pending resolution; the client remains reusable. */
  clear = (): number => {
    const pool = this.#pool;

    this.#pool = new Map();
    this.#resolving.clear();

    const count = pool.size;
    pool.forEach(this.#release);
    pool.clear();

    if (count) this.#announce();
    return count;
  };

  /**
   * Delete the client's store, as on sign-out, whether or not `disableCache`
   * is set. Clients with the same `cacheKey`, or origin, share one store.
   * Held values stay, and later messages are stored again.
   */
  clearCache = async (): Promise<void> => {
    // Each socket's own clear waits for its pending writes, so none lands
    // after the store is gone.
    await Promise.all(
      [...this.#pool.values()].map((socket) => socket.cache.clear())
    );
    await getCacheStorage(this.#configuration.runtime)?.delete(
      this.#storeName()
    );
  };

  dispose = (): void => {
    this.clear();
    this.#disposed = true;
    this.#listeners.clear();
  };

  /** Permanently release one identity. Detach its consumers before eviction. */
  evict = async (
    params: ParamsInput = {} as ParamsInput,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<boolean> => {
    signal?.throwIfAborted();

    const pool = this.#pool;
    const key = await withSignal(this.#resolve(params), signal);

    signal?.throwIfAborted();
    this.#assertActive(pool);

    const socket = this.#pool.get(key);
    if (!socket) return false;
    this.#release(socket);

    this.#pool.delete(key);
    this.#announce();

    return true;
  };

  /**
   * The pooled sockets that have stopped after failures they will not retry
   * (`isExhausted`): those a caller would offer to reconnect. A socket stops
   * being one when its last subscriber leaves, so a screen left behind offers
   * nothing; one opened without subscribers stays one until opened again.
   */
  exhausted = (): Socket<Get, Post, Params>[] =>
    [...this.#pool.values()].filter((socket) => socket.isExhausted);

  /** Resolve subscription identity; opening remains an explicit ownership choice. */
  get = async (
    params: ParamsInput = {} as ParamsInput,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<Socket<Get, Post, Params>> => {
    signal?.throwIfAborted();

    const pool = this.#pool;
    const key = await withSignal(this.#resolve(params), signal);

    signal?.throwIfAborted();
    this.#assertActive(pool);

    const existing = this.#pool.get(key);
    if (existing) return existing;
    if (this.#pool.size >= this.#maxPoolSize) {
      throw new RangeError(
        "SocketClient: pool is full. Evict an unused socket before creating another."
      );
    }

    const socket = new Socket<Get, Post, Params>({
      ...this.#configuration,
      baseURL: "",
      url: key,
    });

    this.#pool.set(key, socket);
    this.#observing.set(socket, socket.observe(this.#announce));
    if (!this.#swept) {
      this.#swept = true;
      void this.#sweep().catch(() => {});
    }

    return socket;
  };

  /**
   * Watch the pool's sockets change state or subscribers, as when one stops
   * or starts again, without subscribing to any. The listener is told that
   * something changed, not what: read `exhausted()` or the sockets. Returns a
   * function that stops watching.
   */
  observe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /**
   * Open the stopped sockets again (`exhausted()`), one after another, with
   * `stagger` between each, so a struggling server is not met with every
   * handshake at once. Resolves once each has connected or stopped again,
   * with how many connected.
   */
  reconnect = (options: ReconnectExhaustedOptions = {}): Promise<number> => {
    return reconnectExhausted([this], options);
  };

  useSocket = <State = Get | undefined>({
    enabled = true,
    initialData,
    params = {} as ParamsInput,
    select = (value) => value as State,
  }: UseSocketOptions<Get, State, ParamsInput> = {}): UseSocketResult<
    Get,
    Post,
    State
  > => {
    const key = enabled ? serializeJSON(params) : "";
    type Resolution = {
      controller: AbortController;
      promise: Promise<Socket<Get, Post, Params>>;
    };

    // Each committed subscription owns one resolution, including Strict Mode replays.
    const subscription = useMemo(
      () => ({ current: null as null | Resolution }),
      [this, key, enabled]
    );

    const [result, setResult] = useState<null | {
      error: Error | null;
      resolution: Resolution;
      socket?: Socket<Get, Post, Params>;
    }>(null);

    useEffect(() => {
      if (!enabled) return;
      const controller = new AbortController();
      const resolution = {
        controller,
        promise: this.get(params, { signal: controller.signal }),
      };
      subscription.current = resolution;
      resolution.promise.then(
        (socket) => {
          if (controller.signal.aborted) return;
          // Before the first render that reads the socket, so the initial
          // data never gives way to an empty socket.
          if (initialData !== undefined) socket.seed(initialData);
          setResult({ error: null, resolution, socket });
        },
        (error) => {
          if (!controller.signal.aborted)
            setResult({ error: toError(error), resolution });
        }
      );
      return () => {
        subscription.current = null;
        controller.abort();
      };
    }, [subscription]);

    const current = result?.resolution === subscription.current ? result : null;
    const socket = current?.socket;
    const error = current?.error ?? null;

    // initialData is read when the subscription starts, not on every render.
    const fallback = useMemo(
      () =>
        socketState({
          binaryType: this.#configuration.binaryType,
          enabled,
          error,
          initialData,
          placeholderData: this.#configuration.placeholderData,
        }),
      [this, enabled, error]
    );

    const subscribe = useCallback(
      (notify: () => void) => socket?.subscribe(notify, false) ?? (() => {}),
      [socket]
    );

    const getSnapshot = useCallback(
      () => (socket ? readSocketSnapshot(socket) : fallback),
      [socket, fallback]
    );

    const snapshot = useSyncExternalStore(
      subscribe,
      getSnapshot,
      () => fallback
    );

    useEffect(() => {
      socket?.open();
    }, [socket]);

    const send = useCallback(
      async (payload: Post, { signal }: { signal?: AbortSignal } = {}) => {
        const resolution = subscription.current;
        if (!resolution) {
          throw new Error("SocketClient: this subscription is disabled.");
        }

        const controller = new AbortController();
        const subscriptionSignal = resolution.controller.signal;
        const abort = () => {
          controller.abort(
            signal?.aborted ? signal.reason : subscriptionSignal.reason
          );
        };

        signal?.addEventListener("abort", abort, { once: true });
        subscriptionSignal.addEventListener("abort", abort, { once: true });
        if (signal?.aborted || subscriptionSignal.aborted) abort();

        try {
          const target = await withSignal(
            resolution.promise,
            controller.signal
          );

          controller.signal.throwIfAborted();
          return await target.send(payload, { signal: controller.signal });
        } finally {
          signal?.removeEventListener("abort", abort);
          subscriptionSignal.removeEventListener("abort", abort);
        }
      },
      [subscription]
    );

    const data = useMemo(
      () => select(snapshot.value),
      [snapshot.value, select]
    );

    // Snapshots have prototype getters; copy the public state contract explicitly.
    return useMemo(
      () => ({
        binaryType: snapshot.binaryType,
        data,
        dataUpdatedAt: snapshot.dataUpdatedAt,
        error: snapshot.error,
        errorUpdatedAt: snapshot.errorUpdatedAt,
        failureCount: snapshot.failureCount,
        failureReason: snapshot.failureReason,
        fetchStatus: snapshot.fetchStatus,
        isConnected: snapshot.isConnected,
        isConnecting: snapshot.isConnecting,
        isDisconnected: snapshot.isDisconnected,
        isError: snapshot.isError,
        isExhausted: snapshot.isExhausted,
        isIdle: snapshot.isIdle,
        isLoading: snapshot.isLoading,
        isPending: snapshot.isPending,
        isPlaceholderData: snapshot.isPlaceholderData,
        isPreparing: snapshot.isPreparing,
        isRefetchError: snapshot.isRefetchError,
        isRefetching: snapshot.isRefetching,
        isStaleData: snapshot.isStaleData,
        isSuccess: snapshot.isSuccess,
        send,
        status: snapshot.status,
        value: snapshot.value,
      }),
      [snapshot, data, send]
    );
  };

  #announce = () => {
    this.#listeners.forEach((listener) => listener());
  };

  #assertActive = (pool = this.#pool) => {
    if (this.#disposed) {
      throw new Error("SocketClient: this client has been disposed.");
    }
    if (pool !== this.#pool) {
      throw new DOMException("Client cleared", "AbortError");
    }
  };

  /** Stop watching a socket leaving the pool, and dispose of it. */
  #release = (socket: Socket<Get, Post, Params>) => {
    this.#observing.get(socket)?.();
    this.#observing.delete(socket);
    socket.dispose();
  };

  #resolve = (params: ParamsInput): Promise<string> => {
    this.#assertActive();

    const identity = serializeJSON(params);
    const existing = this.#resolving.get(identity);
    if (existing) return existing;

    const schema = this.#configuration.paramsSchema;
    const pending = Promise.resolve().then(async () => {
      const normalized = schema
        ? schemaValue(
            await schema["~standard"].validate(params),
            "SocketClient: params schema validation failed"
          )
        : (params as unknown as Params);
      return getUri({ ...this.#configuration, params: normalized });
    });

    this.#resolving.set(identity, pending);
    const cleanup = () => {
      if (this.#resolving.get(identity) === pending)
        this.#resolving.delete(identity);
    };

    void pending.then(cleanup, cleanup);
    return pending;
  };

  /** The Cache Storage store this client's sockets write to. */
  #storeName = (): string => {
    const { baseURL, cacheKey, url } = this.#configuration;
    return cacheKey ?? extractOrigin(getUri({ baseURL, url }));
  };

  /**
   * Delete the store's expired entries. An entry otherwise goes only when its
   * own path is read again, so a store keeps every identity it has seen.
   */
  #sweep = async (): Promise<void> => {
    const storage = getCacheStorage(this.#configuration.runtime);
    const name = this.#storeName();
    if (!storage || !(await storage.has(name))) return;

    const store = await storage.open(name);
    for (const request of await store.keys()) {
      const response = await store.match(request);
      if (response && isExpired(response)) await store.delete(request);
    }
  };
}

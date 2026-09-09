import { Socket } from "@/class/socket";
import { getUri } from "@/functions/get-uri";
import { serializeJSON } from "@/functions/serialize-json";
import { socketState } from "@/functions/socket-state";
import { toError } from "@/functions/to-error";
import { schemaValue } from "@/functions/validate-schema";
import { withSignal } from "@/functions/with-signal";
import type { ConnectionParams } from "@/types/connection-params";
import type { SocketClientConstructor } from "@/types/socket/client-constructor";
import type { UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  ParamsInput = Params,
> {
  #pool = new Map<string, Socket<Get, Post, Params>>();
  #resolving = new Map<string, Promise<string>>();
  #generation = 0;
  #disposed = false;
  #maxPoolSize: number;
  #configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>;

  constructor(
    configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>
  ) {
    this.#configuration = configuration;
    this.#maxPoolSize = configuration.maxPoolSize ?? 1000;
    if (!Number.isInteger(this.#maxPoolSize) || this.#maxPoolSize < 1) {
      throw new RangeError("maxPoolSize must be a positive integer.");
    }
  }

  #assertActive = () => {
    if (this.#disposed)
      throw new Error("SocketClient: this client has been disposed.");
  };

  #resolve = (params: ParamsInput): Promise<string> => {
    this.#assertActive();
    const identity = serializeJSON(params);
    const existing = this.#resolving.get(identity);
    if (existing) return existing;

    const generation = this.#generation;
    const schema = this.#configuration.paramsSchema;
    const pending = Promise.resolve().then(async () => {
      const normalized = schema
        ? schemaValue(
            await schema["~standard"].validate(params),
            "SocketClient: params schema validation failed"
          )
        : (params as unknown as Params);
      if (generation !== this.#generation)
        throw new DOMException("Client cleared", "AbortError");
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

  /** Resolve subscription identity; opening remains an explicit ownership choice. */
  get = async (
    params: ParamsInput = {} as ParamsInput,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<Socket<Get, Post, Params>> => {
    signal?.throwIfAborted();
    const generation = this.#generation;
    const key = await withSignal(this.#resolve(params), signal);
    signal?.throwIfAborted();
    this.#assertActive();
    if (generation !== this.#generation)
      throw new DOMException("Client cleared", "AbortError");
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
    return socket;
  };

  /** Permanently release one identity. Detach its consumers before eviction. */
  evict = async (
    params: ParamsInput = {} as ParamsInput,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<boolean> => {
    signal?.throwIfAborted();
    const generation = this.#generation;
    const key = await withSignal(this.#resolve(params), signal);
    signal?.throwIfAborted();
    if (generation !== this.#generation)
      throw new DOMException("Client cleared", "AbortError");
    const socket = this.#pool.get(key);
    if (!socket) return false;
    socket.dispose();
    this.#pool.delete(key);
    return true;
  };

  /** Empty the pool and invalidate pending resolution; the client remains reusable. */
  clear = (): number => {
    this.#generation += 1;
    this.#resolving.clear();
    const count = this.#pool.size;
    this.#pool.forEach((socket) => socket.dispose());
    this.#pool.clear();
    return count;
  };

  dispose = (): void => {
    this.clear();
    this.#disposed = true;
  };

  useSocket = <State = Get | undefined>({
    params = {} as ParamsInput,
    enabled = true,
    select = (value) => value as State,
  }: UseSocketOptions<Get, State, ParamsInput> = {}): UseSocketResult<
    Get,
    Post,
    State
  > => {
    const key = enabled ? serializeJSON(params) : "";
    type Resolution = {
      key: string;
      client: SocketClient<Get, Post, Params, ParamsInput>;
      controller: AbortController;
      promise: Promise<Socket<Get, Post, Params>>;
    };
    const active = useRef<Resolution | null>(null);
    const [result, setResult] = useState<{
      resolution: Resolution;
      socket?: Socket<Get, Post, Params>;
      error: Error | null;
    } | null>(null);

    useEffect(() => {
      if (!enabled) return;
      const controller = new AbortController();
      const resolution = {
        key,
        client: this,
        controller,
        promise: this.get(params, { signal: controller.signal }),
      };
      active.current = resolution;
      resolution.promise.then(
        (socket) => {
          if (!controller.signal.aborted)
            setResult({ resolution, socket, error: null });
        },
        (error) => {
          if (!controller.signal.aborted)
            setResult({ resolution, error: toError(error) });
        }
      );
      return () => controller.abort();
    }, [this, key, enabled]);

    const current =
      enabled &&
      result?.resolution.client === this &&
      result.resolution.key === key &&
      !result.resolution.controller.signal.aborted;
    const socket = current ? result.socket : undefined;
    const error = current ? result.error : null;
    const fallback = useMemo(
      () =>
        socketState(
          enabled,
          this.#configuration.placeholderData,
          error,
          this.#configuration.binaryType
        ),
      [this, enabled, error]
    );
    const subscribe = useCallback(
      (notify: () => void) => socket?.subscribe(notify, false) ?? (() => {}),
      [socket]
    );
    const snapshot = useSyncExternalStore(
      subscribe,
      socket?.getSnapshot ?? (() => fallback),
      () => fallback
    );
    useEffect(() => {
      socket?.open();
    }, [socket]);

    const send = useCallback(
      async (payload: Post, { signal }: { signal?: AbortSignal } = {}) => {
        const resolution = active.current;
        if (
          !enabled ||
          !resolution ||
          resolution.client !== this ||
          resolution.key !== key
        ) {
          throw new Error("SocketClient: this subscription is disabled.");
        }
        const controller = new AbortController();
        const subscriptionSignal = resolution.controller.signal;
        const abort = () =>
          controller.abort(
            signal?.aborted ? signal.reason : subscriptionSignal.reason
          );
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
      [this, key, enabled]
    );
    const data = useMemo(
      () => select(snapshot.value),
      [snapshot.value, select]
    );
    // Snapshots have prototype getters; copy the public state contract explicitly.
    return useMemo(
      () => ({
        binaryType: snapshot.binaryType,
        dataUpdatedAt: snapshot.dataUpdatedAt,
        error: snapshot.error,
        errorUpdatedAt: snapshot.errorUpdatedAt,
        failureCount: snapshot.failureCount,
        failureReason: snapshot.failureReason,
        fetchStatus: snapshot.fetchStatus,
        isPreparing: snapshot.isPreparing,
        isConnected: snapshot.isConnected,
        isConnecting: snapshot.isConnecting,
        isDisconnected: snapshot.isDisconnected,
        isError: snapshot.isError,
        isIdle: snapshot.isIdle,
        isLoading: snapshot.isLoading,
        isPending: snapshot.isPending,
        isPlaceholderData: snapshot.isPlaceholderData,
        isRefetchError: snapshot.isRefetchError,
        isRefetching: snapshot.isRefetching,
        isStaleData: snapshot.isStaleData,
        isSuccess: snapshot.isSuccess,
        status: snapshot.status,
        value: snapshot.value,
        data,
        send,
      }),
      [snapshot, data, send]
    );
  };
}

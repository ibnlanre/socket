import type { ConnectionParams } from "@/types/connection-params";
import type { SocketClientConstructor } from "@/types/socket/client-constructor";
import type { UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";

import { serializeJSON } from "@/functions/serialize-json";
import { toError } from "@/functions/to-error";
import { schemaValue, validateSchema } from "@/functions/validate-schema";
import { withSignal } from "@/functions/with-signal";
import type { PreparedParams } from "@/types/socket/prepared-params";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

const owners = new WeakMap<object, object>();

import { Socket } from "@/class/socket";
import { getUri } from "@/functions/get-uri";

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  ParamsInput = Params,
> {
  #pool = new Map<string, Socket<Get, Post, Params>>();
  #preparing = new Map<string, Promise<PreparedParams<Params>>>();
  #generation = 0;
  #maxPoolSize: number;
  #configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>;

  constructor(
    configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>
  ) {
    this.#configuration = configuration;
    this.#maxPoolSize = configuration.maxPoolSize ?? 1000;
    if (!Number.isInteger(this.#maxPoolSize) || this.#maxPoolSize < 1)
      throw new RangeError("maxPoolSize must be a positive integer.");
  }

  #destroy = (socket: Socket<Get, Post, Params>) => {
    socket.dispose();
  };

  #parse = (
    input: ParamsInput | PreparedParams<Params> = {} as ParamsInput
  ): PreparedParams<Params> => {
    if (input && typeof input === "object" && owners.has(input)) {
      if (owners.get(input) !== this)
        throw new TypeError(
          "SocketClient: prepared params belong to another client."
        );
      return input as PreparedParams<Params>;
    }
    const schema = this.#configuration.paramsSchema;
    const params = schema
      ? validateSchema(
          schema,
          input as ParamsInput,
          "SocketClient: params schema validation failed"
        )
      : (input as unknown as Params);
    return this.#prepared(params);
  };

  #prepared = (params: Params): PreparedParams<Params> => {
    // The connection URL is resolved now; later input mutation cannot change identity.
    const value = Object.freeze({ ...params }) as Readonly<Params>;
    const key = getUri({ ...this.#configuration, params: value as Params });
    const prepared = Object.freeze({ params: value, key });
    owners.set(prepared, this);
    return prepared;
  };

  #get = ({ key }: PreparedParams<Params>) => {
    const existing = this.#pool.get(key);
    if (existing) return existing;
    if (this.#pool.size >= this.#maxPoolSize)
      throw new RangeError(
        "SocketClient: pool is full. Evict an unused socket before creating another."
      );
    // The fully resolved URL is the sole source of truth for pool and transport.
    const socket = new Socket<Get, Post, Params>({
      ...this.#configuration,
      baseURL: "",
      url: key,
    });
    this.#pool.set(key, socket);
    return socket;
  };

  prepare = (
    params: ParamsInput = {} as ParamsInput,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<PreparedParams<Params>> => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const key = serializeJSON(params);
    let pending = this.#preparing.get(key);
    if (!pending) {
      const generation = this.#generation;
      const schema = this.#configuration.paramsSchema;
      pending = Promise.resolve().then(async () => {
        const value = schema
          ? schemaValue(
              await schema["~standard"].validate(params),
              "SocketClient: params schema validation failed"
            )
          : (params as unknown as Params);
        if (generation !== this.#generation)
          throw new DOMException("Client closed", "AbortError");
        return this.#prepared(value);
      });
      this.#preparing.set(key, pending);
      const cleanup = () => {
        if (this.#preparing.get(key) === pending) this.#preparing.delete(key);
      };
      void pending.then(cleanup, cleanup);
    }
    return withSignal(pending, signal);
  };

  getAsync = async (
    params?: ParamsInput,
    options?: { signal?: AbortSignal }
  ) => {
    const prepared = await this.prepare(params, options);
    options?.signal?.throwIfAborted();
    return this.#get(prepared);
  };

  /** Parameter preparation stays outside render and exposes its own lifecycle. */
  usePreparedParams = (params: ParamsInput, enabled = true) => {
    const key = serializeJSON(params);
    const [result, setResult] = useState<{
      key: string;
      params?: PreparedParams<Params>;
      error: Error | null;
    }>({ key: "", error: null });
    useEffect(() => {
      if (!enabled) return;
      const controller = new AbortController();
      this.prepare(params, { signal: controller.signal }).then(
        (prepared) => {
          if (!controller.signal.aborted)
            setResult({ key, params: prepared, error: null });
        },
        (error) => {
          if (!controller.signal.aborted)
            setResult({ key, error: toError(error) });
        }
      );
      return () => controller.abort();
    }, [key, enabled]);
    const current = enabled && result.key === key;
    return {
      params: current ? result.params : undefined,
      error: current ? result.error : null,
      isPending: enabled && (!current || (!result.params && !result.error)),
    };
  };

  close = (params?: ParamsInput | PreparedParams<Params>): boolean => {
    const { key } = this.#parse(params);
    const socket = this.#pool.get(key);

    if (socket) {
      this.#destroy(socket);
      this.#pool.delete(key);
      return true;
    }

    return false;
  };

  closeAsync = async (
    params?: ParamsInput,
    options?: { signal?: AbortSignal }
  ) => {
    const prepared = await this.prepare(params, options);
    options?.signal?.throwIfAborted();
    return this.close(prepared);
  };

  closeAll = (): number => {
    this.#generation += 1;
    this.#preparing.clear();
    const closed = this.#pool.size;
    this.#pool.forEach(this.#destroy);
    this.#pool.clear();
    return closed;
  };

  /**
   * Retrieves an existing Socket instance or creates a new one
   * under this pool instance.
   */
  get = (params?: ParamsInput | PreparedParams<Params>) =>
    this.#get(this.#parse(params));

  /** Explicit alias for removing and disposing a pooled instance. */
  evict = (params?: ParamsInput | PreparedParams<Params>) => this.close(params);

  useSocket = <State = Get>({
    enabled = true,
    params,
    select = (data) => data as unknown as State,
  }: UseSocketOptions<
    Get,
    State,
    ParamsInput | PreparedParams<Params>
  > = {}): UseSocketResult<Get, Post, State> => {
    const prepared = this.#parse(params);
    const socket = useMemo(() => this.#get(prepared), [prepared.key]);
    const subscribe = useCallback(
      (notify: () => void) => socket.subscribe(notify, false),
      [socket]
    );
    const snapshot = useSyncExternalStore(
      subscribe,
      socket.getSnapshot,
      socket.getSnapshot
    );
    useEffect(() => {
      if (enabled) socket.open();
    }, [socket, enabled]);

    const data = useMemo(
      () => select(snapshot.value),
      [snapshot.value, select]
    );

    // Rebuild the snapshot on every socket notification. The object literal is
    // checked against UseSocketResult, so adding a field to SocketState or
    // SocketCommands forces this list to grow — they cannot drift apart.
    return useMemo<UseSocketResult<Get, Post, State>>(
      () => ({
        binaryType: snapshot.binaryType,
        close: socket.close,
        dataUpdatedAt: snapshot.dataUpdatedAt,
        data,
        error: snapshot.error,
        errorUpdatedAt: snapshot.errorUpdatedAt,
        failureCount: snapshot.failureCount,
        failureReason: snapshot.failureReason,
        fetchStatus: snapshot.fetchStatus,
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
        on: socket.on,
        open: socket.open,
        send: socket.send,
        sendAsync: socket.sendAsync,
        status: snapshot.status,
        value: snapshot.value,
        waitUntil: socket.waitUntil,
      }),
      [data, snapshot, socket]
    );
  };

  /** Subscribe only to selected data; unrelated connection changes do not render. */
  useValue = <State = Get>({
    params,
    enabled = true,
    select = (value) => value as State,
    isEqual = Object.is,
  }: UseSocketOptions<Get, State, ParamsInput | PreparedParams<Params>> & {
    isEqual?: (previous: State, next: State) => boolean;
  } = {}): State => {
    const prepared = this.#parse(params);
    const socket = useMemo(() => this.#get(prepared), [prepared.key]);
    const subscribe = useCallback(
      (notify: () => void) => socket.subscribe(notify, false),
      [socket]
    );
    const value = useSyncExternalStoreWithSelector(
      subscribe,
      socket.getSnapshot,
      socket.getSnapshot,
      (snapshot) => select(snapshot.value),
      isEqual
    );
    useEffect(() => {
      if (enabled) socket.open();
    }, [socket, enabled]);
    return value;
  };
}

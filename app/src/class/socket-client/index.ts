import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";

import { useEffect, useMemo, useState } from "react";

import { Socket } from "@/class/socket";
import { getUri } from "@/functions/get-uri";

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
> {
  #pool = new Map<string, Socket<Get, Post, Params>>();
  #configuration: SocketConstructor<Get, Post, Params>;

  constructor(configuration: SocketConstructor<Get, Post, Params>) {
    this.#configuration = configuration;
  }

  #destroy = (socket: Socket<Get, Post, Params>) => {
    socket.close();
    socket.cache.clear();
  };

  #parse = (params: Params) => {
    const parser = this.#configuration.paramsSchema;
    if (!parser) return params;

    const result = parser["~standard"].validate(params);
    if (result instanceof Promise) {
      throw new TypeError(
        "SocketClient: async params schemas are not supported. Validate params before creating or retrieving a socket."
      );
    }

    if (result.issues) {
      const message = "SocketClient: params schema validation failed";
      throw new Error(message, { cause: result.issues });
    }

    return result.value;
  };

  #stringify = (params: Params = {} as Params) => {
    return getUri({ ...this.#configuration, params: this.#parse(params) });
  };

  close = (params?: Params): boolean => {
    const key = this.#stringify(params);
    const socket = this.#pool.get(key);

    if (socket) {
      this.#destroy(socket);
      this.#pool.delete(key);
      return true;
    }

    return false;
  };

  closeAll = (): number => {
    const closed = this.#pool.size;
    this.#pool.forEach(this.#destroy);
    this.#pool.clear();
    return closed;
  };

  /**
   * Retrieves an existing Socket instance or creates a new one
   * under this pool instance.
   */
  get = (params?: Params) => {
    const key = this.#stringify(params);
    const existingSocket = this.#pool.get(key);

    if (existingSocket) return existingSocket;

    const socket = new Socket(this.#configuration, params);
    this.#pool.set(key, socket);

    return socket;
  };

  useSocket = <State = Get>({
    enabled = true,
    params,
    select = (data) => data as unknown as State,
  }: UseSocketOptions<Get, State, Params> = {}): UseSocketResult<
    Get,
    Post,
    State
  > => {
    const key = this.#stringify(params);
    const socket = useMemo(() => this.get(params), [key]);

    const [snapshot, setSnapshot] = useState(socket);
    const [previousSocket, setPreviousSocket] = useState(socket);

    // Adjust state during render when the pooled socket instance changes so a
    // params change never mixes the old socket's state with the new commands.
    if (previousSocket !== socket) {
      setPreviousSocket(socket);
      setSnapshot(socket);
    }

    useEffect(() => socket.subscribe(setSnapshot), [socket]);
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
        status: snapshot.status,
        value: snapshot.value,
        waitUntil: socket.waitUntil,
      }),
      [data, snapshot, socket]
    );
  };
}

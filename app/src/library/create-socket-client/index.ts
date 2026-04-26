import { useEffect, useMemo, useState } from "react";

import { SocketClient } from "@/class/socket-client";
import { getUri } from "@/library/get-uri";

import { shallowMerge } from "@/functions/shallow-merge";
import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { SocketOptions, UseSocketOptions } from "@/types/socket/options";
import type { UseSocketResult } from "@/types/use-socket-result";

export function createSocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
>(configuration: SocketConstructor<Get, Post, Params>) {
  type Socket = SocketClient<Get, Post, Params>;
  const sockets = new Map<string, Socket>();

  function parseParams(params?: Params) {
    if (!configuration.paramsSchema) return params;

    const result = configuration.paramsSchema.safeParse(params);
    if (result.success) return result.data;

    throw new Error(result.error.message);
  }

  function get(options: SocketOptions<Params> = {}) {
    const params = parseParams(options.params);
    const key = getUri({ ...configuration, params });
    if (sockets.has(key)) return sockets.get(key)!;

    const client = new SocketClient(configuration, params);
    sockets.set(key, client);

    return client;
  }

  function use<State = Get>({
    enabled = true,
    initialData = undefined as State,
    params,
    select = (data) => data as unknown as State,
  }: UseSocketOptions<Get, State, Params> = {}): UseSocketResult<
    Get,
    Post,
    Params,
    State
  > {
    const key = getUri({ ...configuration, params });
    const socket = useMemo(() => get({ params }), [key]);
    const [{ value }, setClient] = useState(socket);

    useEffect(() => socket.subscribe(setClient), [socket]);
    useEffect(() => socket.open(enabled), [socket, enabled]);

    const data = typeof value === "undefined" ? initialData : select(value);
    return shallowMerge(socket, { data });
  }

  function close(options: SocketOptions<Params> = {}): boolean {
    const params = parseParams(options.params);
    const key = getUri({ ...configuration, params });
    const socket = sockets.get(key);

    if (socket) {
      socket.close();
      socket.cache.clear();
      return sockets.delete(key);
    }

    return false;
  }

  function closeAll(): void {
    sockets.forEach((socket) => {
      socket.close();
      socket.cache.clear();
    });
    sockets.clear();
  }

  function preset<State>(options: UseSocketOptions<Get, State, Params>) {
    return options;
  }

  return {
    closeAll,
    close,
    get,
    preset,
    use,
  };
}

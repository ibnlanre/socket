import { useEffect, useMemo, useState } from "react";

import { SocketClient } from "@/class/socket-client";
import { shallowMerge } from "@/functions/shallow-merge";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { SocketSelector } from "@/types/socket/selector";
import type { UseSocketResult } from "@/types/use-socket-result";

type UseSocketOptions<
  Get = unknown,
  Params extends ConnectionParams = never,
  State = Get
> = {
  params?: Params;
  select?: SocketSelector<Get, State>;
};

export function createSocketClient<
  Get = unknown,
  Params extends ConnectionParams = never,
  Post = never
>(configuration: SocketConstructor<Get, Post>) {
  type Socket = SocketClient<Get, Params, Post>;
  const sockets = new Map<string, Socket>();

  function initialize(params: Params = {} as Params): Socket {
    const key = getUri({ ...configuration, params });
    if (sockets.has(key)) return sockets.get(key)!;

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    sockets.set(key, client);

    return client;
  }

  function use<State>({
    params = {} as Params,
    select = (data) => data as State,
  }: UseSocketOptions<Get, Params, State> = {}): UseSocketResult<
    Get,
    Params,
    Post,
    State
  > {
    const key = getUri({ ...configuration, params });
    const socket = useMemo(() => initialize(params), [key]);
    const [socketState, setSocketState] = useState(socket);

    useEffect(() => socket.open(), [socket]);
    useEffect(() => socket.subscribe(setSocketState), [socket]);

    return shallowMerge(socketState, { data: select(socketState.value) });
  }

  function cleanup(params: Params = {} as Params): boolean {
    const key = getUri({ ...configuration, params });
    const socket = sockets.get(key);
    if (socket) {
      socket.close();
      socket.cache.clear();
      return sockets.delete(key);
    }
    return false;
  }

  function cleanupAll(): void {
    sockets.forEach((socket) => {
      socket.close();
      socket.cache.clear();
    });
    sockets.clear();
  }

  return {
    use,
    initialize,
    cleanup,
    cleanupAll,
    sockets,
  };
}

import { useEffect, useMemo, useReducer } from "react";

import { SocketClient } from "@/class/socket-client";
import { shallowMerge } from "@/functions/shallow-merge";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { SocketSelector } from "@/types/socket/selector";
import type { UseSocketResult } from "@/types/use-socket-result";

export function createSocketClient<
  Get = unknown,
  Params extends ConnectionParams = never,
  Post = never
>(configuration: SocketConstructor<Get, Post>) {
  type Socket = SocketClient<Get, Params, Post>;
  const sockets = new Map<string, Socket>();

  function initialize(params: Params = <Params>{}) {
    const key = getUri({ ...configuration, params });
    if (sockets.has(key)) return <Socket>sockets.get(key);

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    sockets.set(key, client);

    return client;
  }

  function use<State>(
    params: Params = <Params>{},
    select: SocketSelector<Get, State> = (data) => <State>data
  ): UseSocketResult<Get, Params, Post, State> {
    const key = getUri({ ...configuration, params });
    const store = useMemo(() => {
      return { [key]: initialize(params) };
    }, [key]);

    const [, dispatch] = useReducer((prev, next) => {
      return shallowMerge(prev, { [key]: next });
    }, store);

    const socket = store[key];
    useEffect(socket.open, [socket]);
    useEffect(socket.subscribe(dispatch), [socket]);

    return shallowMerge(socket, { data: select(socket.value) });
  }

  return {
    use,
    initialize,
    sockets,
  };
}

import { useEffect, useMemo, useReducer } from "react";

import { SocketClient } from "@/class/socket-client";
import { shallowMerge } from "@/functions/shallow-merge";
import { getUri } from "@/library/get-uri";

import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketParams } from "@/types/socket-params";
import type { SocketSelector } from "@/types/socket-selector";
import type { UseSocketResult } from "@/types/use-socket-result";

export function createSocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(configuration: SocketConstructor<Get, Post>) {
  type Socket = SocketClient<Get, Params, Post>;

  const sockets = new Map<string, Socket>();

  function initialize(params: Params = {} as Params) {
    const key = getUri({ ...configuration, params });
    if (sockets.has(key)) return sockets.get(key) as Socket;

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    sockets.set(key, client);

    return client;
  }

  function use<State>(
    params: Params = {} as Params,
    select: SocketSelector<Get, State> = (data) => data as State
  ): UseSocketResult<Get, Params, Post, State> {
    const key = getUri({ ...configuration, params });

    const store = useMemo(() => {
      return { [key]: initialize(params) };
    }, [key]);

    const socket = store[key];
    const [, dispatch] = useReducer((prev, next) => {
      console.log("inside reducer", prev, next);
      return shallowMerge(prev, { [key]: next });
    }, store);

    useEffect(() => {
      console.log("inside effect", socket);
      const unsubscribe = socket.subscribe(dispatch);
      socket.open();
      return unsubscribe;
    }, [socket]);

    console.log("outside effect", socket);
    return shallowMerge(socket, { data: select(socket.value) });
  }

  return {
    use,
    initialize,
    sockets,
  };
}

import { useEffect, useMemo, useState } from "react";

import { getUri } from "@/get-uri";
import { SocketClient } from "@/socket-client";

import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketParams } from "@/types/socket-params";
import type { SocketSelector } from "@/types/socket-selector";

export function createSocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(configuration: SocketConstructor<Get, Post>) {
  type Socket = SocketClient<Get, Params, Post>;

  const sockets = new Map<string, Socket>();
  const { baseURL, url } = configuration;

  function initialize(params: Params = {} as Params) {
    const key = getUri({ baseURL, url, params });
    if (sockets.has(key)) return sockets.get(key) as Socket;

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    sockets.set(key, client);

    return client;
  }

  function use<State>(
    params: Params = {} as Params,
    select: SocketSelector<Get, State> = (data) => data as State
  ) {
    const [, forceUpdate] = useState({});

    const key = getUri({ baseURL, url, params });
    const client = useMemo<Socket>(() => initialize(params), [key]);

    useEffect(() => {
      const unsubscribe = client.subscribe(forceUpdate);
      client.open();

      return unsubscribe;
    }, [key]);

    return Object.assign(client, { data: select(client.value) });
  }

  return {
    use,
    initialize,
    sockets,
  };
}

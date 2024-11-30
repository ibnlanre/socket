import { useEffect, useState } from "react";

import { SocketClient } from "@/class/socket-client";
import { getUri } from "@/functions/get-uri";
import { shallowMerge } from "@/functions/shallow-merge";

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
  ): UseSocketResult<Get, Params, Post, State> {
    const [client, setClient] = useState(() => initialize(params));
    const key = getUri({ baseURL, url, params });

    useEffect(() => {
      const unsubscribe = client.subscribe(setClient);
      client.open();

      return unsubscribe;
    }, [key]);

    return shallowMerge(client, { data: select(client.value) });
  }

  return {
    use,
    initialize,
    sockets,
  };
}

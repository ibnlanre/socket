import { useEffect, useMemo, useState } from "react";

import { getUri } from "@/get-uri";
import { SocketClient } from "@/socket-client";

import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketParams } from "@/types/socket-params";
import type { SocketSelector } from "@/types/socket-selector";
import type { UseSocketResult } from "@/types/use-socket-result";

export function createSocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(configuration: SocketConstructor) {
  const socks = new Map<string, SocketClient<Get, Params, Post>>();
  const { baseURL, url } = configuration;

  function initialize(params: Params = {} as Params) {
    const key = getUri({ baseURL, url, params });

    if (socks.has(key)) {
      return socks.get(key) as SocketClient<Get, Params, Post>;
    }

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    socks.set(key, client);

    return client;
  }

  function use<State>(
    params: Params = {} as Params,
    select: SocketSelector<Get, State> = (data) => data as State
  ): UseSocketResult<Get, Params, Post, State> {
    const [value, setValue] = useState<Get>();

    const key = getUri({ baseURL, url, params });
    const client = useMemo(() => initialize(params), [key]);

    useEffect(() => {
      const unsubscribe = client.cache.subscribe(setValue);
      client.open();

      return () => {
        unsubscribe();
        if (!client.cache.subscribers) socks.delete(key);
      };
    }, [key]);

    const data = select(value);
    return Object.assign(client, { data });
  }

  return {
    use,
    initialize,
    socks,
  };
}

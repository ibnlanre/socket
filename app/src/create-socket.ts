import { useEffect, useMemo, useState } from "react";

import { combineURLs } from "./combine-urls";
import { getUri } from "./get-uri";
import { isAbsoluteURL } from "./is-absolute-url";
import { paramsSerializer } from "./params-serializer";
import { SocketClient } from "./socket-client";

import type { SocketConstructor } from "./types/socket-constructor";
import type { SocketParams } from "./types/socket-params";

export function createSocket<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(configuration: SocketConstructor) {
  const sockets = new Map<string, SocketClient<Get, Params, Post>>();
  const { baseURL, url } = configuration;

  function initialize(params: Params = {} as Params) {
    const key = getUri({ baseURL, url, params });

    if (sockets.has(key)) {
      return sockets.get(key) as SocketClient<Get, Params, Post>;
    }

    const client = new SocketClient<Get, Params, Post>(configuration, params);
    sockets.set(key, client);
    return client;
  }

  function use(params: Params = {} as Params) {
    const [, setData] = useState<Get>();

    const key = getUri({ baseURL, url, params });
    const client = useMemo(() => initialize(params), [key]);

    useEffect(() => {
      const unsubscribe = client.cache.subscribe(setData);
      client.open();

      return unsubscribe;
    }, [key]);

    return client;
  }

  return {
    use,
    initialize,
    isAbsoluteURL,
    paramsSerializer,
    combineURLs,
    getUri,
  };
}

const socket = createSocket({
  url: "wss://example.com",
  retryOnSpecificCloseCodes: [1006, 1015],
  retryOnCustomCondition: (event, client) => event.code === 1006,
  baseURL: "https://example.com",
});

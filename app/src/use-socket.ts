import { createSocket, Socket } from "dgram";
import { config } from "process";
import { useState, useEffect } from "react";
import { getUri } from "./get-uri";
import { SocketConstructor } from "./types/socket-constructor";
import { SocketEvent } from "./types/socket-event";
import { SocketFetchStatus } from "./types/socket-fetch-status";
import { SocketParams } from "./types/socket-params";
import { SocketStatus } from "./types/socket-status";
import { SocketURI } from "./types/socket-uri";
import { SocketClient } from "./socket-client";
import { socketManager } from "./socket-manager";

const socket = {
  instance: null,
  create({
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
  }) {
    const instance = new WebSocket(url);

    instance.onmessage = onMessage;
    instance.onopen = onOpen;
    instance.onclose = onClose;
    instance.onerror = onError;

    return instance;
  })
}

const { data, status } = useQuery({
  queryKey: ["socket", "wss://stream.binance.com:9443/ws/btcusdt@trade"],
  queryFn: () => {
    const socket = createSocket({
      url: "wss://stream.binance.com:9443/ws/btcusdt@trade",
      onMessage: (event) => {
        console.log(event.data);
      },
      onOpen: () => {
        console.log("Connected");
      },
      onClose: () => {
        console.log("Disconnected");
      },
      onError: (event) => {
        console.error(event);
      },
    });

    return {
      data: socket,
      status: "success",
    };
  }
})


class SocketManager<Get = unknown, Post = never> {
  #retryDelay: number;

  #log: SocketEvent[];
  #retry: boolean;

  #socks = new Map<string, WebSocket>();
  #storage = new WeakMap<WebSocket, Get>();

  #subscribers: Set<Function> = new Set();
  #baseURL: string;

  instance: WebSocket | null = null;
  status: SocketStatus = "pending";
  fetchStatus: SocketFetchStatus = "idle";

  constructor({
    log = ["open", "close", "error"],
    retryDelay = 1000,
    retry = false,
  }: SocketConstructor) {
    this.#log = log;
    this.#retry = retry;
    this.#retryDelay = retryDelay;
    this.#baseURL = baseURL;
  }

  #getDependencies = (params: SocketParams = {}) => {
    return Object.values(params);
  };

  connect = (
    url: string,
    setMessage: (value: Get) => void,
    params?: SocketParams
  ) => {
    const uri = getUri({
      url,
      baseURL: this.#baseURL,
      params,
    });

    this.instance = new WebSocket(uri);

    return this.close;
  };

  use = (url: string, params?: SocketParams) => {
    const [data, setData] = useState<Get>();
    const parameters = this.#getDependencies(params);

    useEffect(() => {
      return this.connect(url, setData, params);
    }, [url, ...parameters]);

    return {
      data,
      status: this.status,
      fetchStatus: this.fetchStatus,
    };
  };
}

  // #sockets = new Map<string, Socket<Get, Post>>();
  // constructor(config: SocketConstructor) {
  //   this.createSocket(config);
  // }
  // createSocket = (config: SocketConstructor) => {
  //   const socket = createSocket<Get, Post>(config);
  //   this.#sockets.set(config.baseURL, socket);
  //   return socket;
  // };
  // getSocket = (baseURL: string) => {
  //   return this.#sockets.get(baseURL);
  // };


  function useSocket<Get extends unknown>(client: SocketClient<Get>) {
    const cacheKey = getUri(props);
    const [data, setData] = useState<Get>();

    if (!socketManager.has(key)) {
      const socket = new Socket<Get, Post>(config);

      socketManager.set(key, socket);
    }

    useEffect(() => {

    }, []);

    return socketManager.get(key);
  }

  return useSocket;

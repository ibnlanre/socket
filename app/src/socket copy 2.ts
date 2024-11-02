import { useEffect, useState } from "react";

import { SocketCloseCode } from "./constants/SocketCloseCode";
import { SocketCloseReason } from "./constants/SocketCloseReason";

import { getUri } from "./get-uri";
import type { SocketConstructor } from "./types/SocketConstructor";
import type { SocketEvent } from "./types/SocketEvent";
import type { SocketFetchStatus } from "./types/SocketFetchStatus";
import type { SocketParams } from "./types/SocketParams";
import type { SocketStatus } from "./types/SocketStatus";

type SecurityList = {
  code: string;
  name: string;
  image_link: string;
  security_type: string;
  board_code: string;
  is_tradable: string;
  can_be_sold: string;
  can_be_bought: string;
  board_name: string;
};

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
}

interface SocketArgs {
  url: string;
  log: SocketEvent[];
  retry: boolean;
  baseURL?: string;
}

interface SocketConnect {
  url: string;
  protocols?: string | string[];
  params?: SocketParams;
}

class Socket<Get = unknown, Post = never> {
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

  #currentState: Get | null = null;
  #timerId: Timer | null = null;

  /**
   * The set of subscribers to the subject.
   *
   * @private
   * @type {Set<Function>}
   */
  #subscribers: Set<Function> = new Set();

  #retry: boolean = false;
  #cache: boolean = false;
  #cacheKey: string = "no-cache";
  #retryDelay: number = 1000;
  #log: SocketEvent[] = ["open", "close", "error"];

  instance: WebSocket | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  status: SocketStatus = "pending";

  #connect = ({ url, protocols, params = {} }: SocketConnect) => {
    const uri = getUri({
      url,
      baseURL: this.#baseURL,
      params,
    });

    this.instance = new WebSocket(uri, protocols);
    this.fetchStatus = "connecting";

    this.instance.onopen = (ev: Event) => {
      this.fetchStatus = "connected";

      if (this.#log.includes("open")) {
        const target = ev.target as WebSocket;
        console.info("WebSocket connected", {
          url: target.url,
        });
      }
    };

    this.instance.onmessage = (ev: MessageEvent) => {
      this.status = "success";

      try {
        const data = JSON.parse(ev.data);
        queueMicrotask(() => this.#publish(data));

        if (this.#log.includes("message")) {
          const target = ev.target as WebSocket;
          console.info("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (this.#log.includes("error")) {
          const target = ev.target as WebSocket;
          console.error("Error occurred while updating socket", {
            data: ev.data,
            url: target.url,
            error: err,
          });
        }
      }
    };

    this.instance.onclose = (ev: CloseEvent) => {
      this.fetchStatus = "disconnected";

      if (this.#log.includes("close")) {
        const target = ev.target as WebSocket;
        const errorCode = ev.code as SocketCloseCode;

        console.info("WebSocket disconnected", {
          url: target.url,
          reason: SocketCloseCode[errorCode],
          explanation: SocketCloseReason[errorCode],
          code: errorCode,
        });
      }

      if (this.#retry) {
        if (ev.code === SocketCloseCode.ABNORMAL_CLOSURE) {
          this.#reconnect();
        }
      } else {
        if (this.#timerId) {
          clearTimeout(this.#timerId);
        }
        this.instance = null;
      }
    };

    this.instance.onerror = (ev: Event) => {
      this.status = "error";

      if (this.#log.includes("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };
  };

  #reconnect = () => {
    this.#timerId = setTimeout(this.#connect, this.#retryDelay);
  };

  #notifySubscribers = () => {
    this.#subscribers.forEach((fn) => fn());
  };

  #publish = (value: Get) => this.#subscribers.forEach((fn) => fn(value));

  close = () => {
    if (this.instance?.readyState !== WebSocket.CLOSED) {
      this.instance?.close();
    }
  };

  send = (data: Post) => {
    if (this.instance?.readyState === WebSocket.OPEN) {
      this.instance.send(JSON.stringify(data));
    }
  };

  on = (event: SocketEvent, callback: (ev: Event) => void) => {
    this.instance?.addEventListener(event, callback);
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
      send: this.send,
    };
  };

  subscribe = (observer: (value: Get) => void, immediate = true) => {
    if (!this.#subscribers.has(observer)) {
      this.#subscribers.add(observer);
      if (immediate) observer(this.#currentState);
    }
    return { unsubscribe: () => this.#subscribers.delete(observer) };
  };

  /**
   * Unsubscribes all subscribers from the subject.
   */
  unsubscribe = (): void => {
    this.#subscribers.clear();
  };

  constructor({ url, log, retry, baseURL, params }: SocketArgs) {
    this.url = getUri({
      url,
      baseURL,
      params,
    });

    this.instance = new WebSocket(url);
    this.#log = log;
    this.#retry = retry;
  }
}

type CreateSocket = SocketConstructor & {
  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;
};

function createSocket<Get = unknown, Post = never>({
  baseURL,
  ...config
}: CreateSocket) {
  const socketManager = new Map<string, Socket<Get, Post>>();

  function useSocket(url: string, params?: SocketParams) {
    const key = getUri({ baseURL, url, params });
    const [data, setData] = useState<Get>();

    if (!socketManager.has(key)) {
      const socket = new Socket<Get, Post>(config);

      socketManager.set(key, socket);
    }

    return socketManager.get(key);
  }

  return socket;
}

const ovs = createSocket<SecurityList>({
  log: ["close"],
  paths: ["v2/api/orders"],
  baseURL: "ws://localhost:8080",
  cache: true,
  cacheKey: "ovs-socket",
  retry: true,
});

interface OvsSocket {
  currency_code: string | null;
  security_code: string | null;
  board_code: string | null;
}

function App() {
  const [currencyCode, setCurrencyCode] = useState<string>("NGN");
  const [securityCode, setSecurityCode] = useState<string | null>(null);
  const [boardCode, setBoardCode] = useState<string | null>(null);

  const params = {
    currency_code: currencyCode,
    security_code: securityCode,
    board_code: boardCode,
  };

  const { data } = ovs.use("", params);
}

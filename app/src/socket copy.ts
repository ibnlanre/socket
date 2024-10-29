import { useEffect, useState } from "react";

import { WebSocketCloseCode } from "./constants/web-socket-close-code";
import { WebSocketCloseReason } from "./constants/web-socket-close-reason";

import { getUri } from "./get-uri";
import type { SocketConstructor } from "./types/SocketConstructor";
import type { SocketEvent } from "./types/SocketEvent";
import type { SocketFetchStatus } from "./types/SocketFetchStatus";
import type { SocketParams } from "./types/SocketParams";
import type { SocketStatus } from "./types/SocketStatus";
import { url } from "inspector";

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
  #timerId: Timer | null = null;
  #socks = new Map<string, WebSocket>();
  #storage = new WeakMap<WebSocket, Get>();
  #cacheKey: string = "no-cache";
  #subscribers: Set<Function> = new Set();
  #baseURL: string;

  instance: WebSocket | null = null;
  status: SocketStatus = "pending";
  fetchStatus: SocketFetchStatus = "idle";

  constructor({
    baseURL = "",
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

  #notifySubscribers = () => {
    this.#subscribers.forEach((fn) => fn());
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

  instance: WebSocket | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  status: SocketStatus = "pending";

  #reconnect = (url: string, setMessage: (value: Get) => void) => {
    this.#timerId = setTimeout(() => {
      this.connect(url, setMessage);
    }, this.#retryDelay);
  };

  constructor(uri: string, log: SocketEvent[], retry: boolean) {
    this.instance = new WebSocket(uri);
    this.fetchStatus = "connecting";

    this.instance.onopen = (ev: Event) => {
      this.fetchStatus = "connected";

      if (log.includes("open")) {
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
        queueMicrotask(() => setMessage(data));

        if (log.includes("message")) {
          const target = ev.target as WebSocket;
          console.info("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (log.includes("error")) {
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

      if (log.includes("close")) {
        const target = ev.target as WebSocket;
        const errorCode = ev.code as WebSocketCloseCode;

        console.info("WebSocket disconnected", {
          url: target.url,
          reason: WebSocketCloseCode[errorCode],
          explanation: WebSocketCloseReason[errorCode],
          code: errorCode,
        });
      }

      if (retry) {
        if (ev.code === WebSocketCloseCode.ABNORMAL_CLOSURE) {
          this.#reconnect(url, setMessage);
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

      if (log.includes("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };
  }

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
}

function createSocket<Get = unknown, Post = never>(config: SocketConstructor) {
  return new SocketManager<Get, Post>(config);
}

const ws = createSocket<SecurityList>({
  baseURL: "ws://localhost:8080",
});

interface OvsSocket {
  currency_code: string | null;
  security_code: string | null;
  board_code: string | null;
}

function useOvsSocket({ currency_code, security_code, board_code }: OvsSocket) {
  return ws.use("v2/api/orders", {
    currency_code,
    security_code,
    board_code,
  });
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

  const { data } = useOvsSocket(params);
}

import { useEffect, useState } from "react";
import { combineURLs } from "./combine-urls";

import { WebSocketCloseCode } from "./constants/web-socket-close-code";
import { WebSocketCloseReason } from "./constants/web-socket-close-reason";
import { isAbsoluteURL } from "./is-absolute-url";

import type { SocketConstructor } from "./types/SocketConstructor";
import type { SocketEvent } from "./types/SocketEvent";
import type { SocketFetchStatus } from "./types/SocketFetchStatus";
import type { SocketParams } from "./types/SocketParams";
import type { SocketParamsSerializer } from "./types/SocketParamsSerializer";
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

class Socket<Get = unknown, Post = never> {
  #log: SocketEvent[];
  #retry: boolean;
  #retryDelay: number;
  #timerId: Timer | null = null;
  #socks = new Map<string, WebSocket>();
  #storage = new WeakMap<WebSocket, Get>();
  #subscribers: Set<Function> = new Set();
  #cacheKey: string = "no-cache";
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

  #paramsSerializer: SocketParamsSerializer = (params) => {
    const searchParams = new URLSearchParams();

    for (const key in params) {
      const item = encodeURIComponent(params[key] ?? "");
      if (item !== "") searchParams.append(key, item);
    }

    return searchParams.toString();
  };

  #uri = (url: string, params?: SocketParams) => {
    const base = isAbsoluteURL(url) ? "" : this.#baseURL;
    const fullPath = combineURLs(base, url);
    if (!params) return fullPath;

    const serializedParams = this.#paramsSerializer(params);
    const pathname = new URL(fullPath);
    pathname.search = serializedParams;

    return pathname.href;
  };

  #reconnect = (url: string, setMessage: (value: Get) => void) => {
    this.#timerId = setTimeout(() => {
      this.connect(url, setMessage);
    }, this.#retryDelay);
  };

  connect = (
    url: string,
    setMessage: (value: Get) => void,
    params?: SocketParams
  ) => {
    const uri = this.#uri(url, params);
    this.instance = new WebSocket(uri);
    this.fetchStatus = "connecting";

    if (this.#socks.has(uri)) {
    } else this.#socks.set(uri, this.instance);

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
        queueMicrotask(() => setMessage(data));

        if (this.instance) this.#storage.set(this.instance, data);
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
        const errorCode = ev.code as WebSocketCloseCode;

        console.info("WebSocket disconnected", {
          url: target.url,
          reason: WebSocketCloseCode[errorCode],
          explanation: WebSocketCloseReason[errorCode],
          code: errorCode,
        });
      }

      if (this.#retry) {
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

      if (this.#log.includes("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };

    return this.close;
  };

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
    };
  };
}

function createSocket<Get = unknown, Post = never>(config: SocketConstructor) {
  return new Socket<Get, Post>(config);
}

const ws = createSocket<SecurityList>({
  baseURL: "ws://localhost:8080",
});

ws.connect("v2/api/orders", (data) => {
  console.log(data);
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

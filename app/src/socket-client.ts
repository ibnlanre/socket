import { SocketCloseCode } from "./constants/socket-close-code";
import { SocketCloseReason } from "./constants/socket-close-reason";
import { getUri } from "./get-uri";
import { SocketBase } from "./socket-base";

import type { SocketConstructor } from "./types/socket-constructor";
import type { SocketEvent } from "./types/socket-event";
import type { SocketFetchStatus } from "./types/socket-fetch-status";
import type { SocketParams } from "./types/socket-params";
import type { SocketStatus } from "./types/socket-status";
import type { SocketTimeout } from "./types/socket-timeout";

export function createSocket<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(configuration: SocketConstructor) {
  const sockets = new Map<string, SocketClient>();

  return {
    link: (params: Params = {} as Params) => {
      const { baseURL, url } = configuration;
      const key = getUri({ baseURL, url, params });

      if (sockets.has(key)) {
        return sockets.get(key) as SocketClient<Get, Params, Post>;
      }

      const client = new SocketClient<Get, Params, Post>(configuration);
      sockets.set(key, client);
      return client;
    },
  };
}

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

type Params = {
  currency_code: "NGN";
  security_code: "AAPL";
  board_code: "NGSE";
};

const socket = createSocket<SecurityList, Params>({
  url: "/v2/api/orders",
  baseURL: "ws://localhost:8080",
});

const client = socket.link({
  currency_code: "NGN",
  security_code: "AAPL",
  board_code: "NGSE",
});

export class SocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
> extends SocketBase {
  instance: WebSocket | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  status: SocketStatus = "loading";
  path: string = "";

  #eventListeners: Map<string, EventListener> = new Map();
  #timerId: SocketTimeout = undefined;
  #state?: Get;

  #calculateBackoff(): number {
    switch (this.retryBackoffStrategy) {
      case "fixed": {
        return Math.min(this.retryDelay, this.maxRetryDelay);
      }

      case "exponential": {
        const delay = Math.min(
          this.retryDelay * Math.pow(2, this.currentRetryAttempt),
          this.maxRetryDelay
        );

        const jitterBufferValue = this.maxJitterValue - this.minJitterValue;
        const jitterBufferTarget = Math.random() * jitterBufferValue;
        const jitterFactor = this.minJitterValue + jitterBufferTarget;

        return delay * jitterFactor;
      }
    }
  }

  #cleanup() {
    this.#cleanupEventListeners();
    this.#cleanupNetworkListener();
    clearTimeout(this.#timerId);
    this.instance = null;
  }

  #shouldRetry(event: CloseEvent): boolean {
    const target = event.target as WebSocket;
    const errorCode = event.code as SocketCloseCode;

    if (this.log.includes("close")) {
      console.info("WebSocket disconnected", {
        url: target.url,
        reason: SocketCloseCode[errorCode],
        explanation: SocketCloseReason[errorCode],
        code: errorCode,
      });
    }

    if (this.currentRetryAttempt >= this.retryCount) {
      this.#cleanup();
      return false;
    }

    if (this.retry) {
      if (this.retryOnCustomCondition?.(event, target)) return true;
      if (this.retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    this.#cleanup();
    return false;
  }

  #setupNetworkListener() {
    if (!this.retryOnNetworkRestore) return;

    this.networkRestoreListener = () => {
      if (this.fetchStatus === "disconnected") {
        this.currentRetryAttempt = 0;
        this.#reconnect();
      }
    };

    window.addEventListener("online", this.networkRestoreListener);
  }

  #cleanupNetworkListener() {
    if (this.networkRestoreListener) {
      window.removeEventListener("online", this.networkRestoreListener);
      this.networkRestoreListener = null;
    }
  }

  #reconnect = () => {
    this.fetchStatus = "idle";

    this.currentRetryAttempt++;
    const backoffDelay = this.#calculateBackoff();
    this.#timerId = setTimeout(this.#connect, backoffDelay);
  };

  #connect = () => {
    this.instance = new WebSocket(this.path);
    this.fetchStatus = "connecting";

    this.instance.onopen = (ev: Event) => {
      this.currentRetryAttempt = 0;
      this.#setupNetworkListener();
      this.fetchStatus = "connected";

      if (this.log.includes("open")) {
        const target = ev.target as WebSocket;
        console.info("WebSocket connected", {
          url: target.url,
        });
      }
    };

    this.instance.onmessage = (ev: MessageEvent) => {
      this.status = "success";

      try {
        this.#state = JSON.parse(ev.data);

        if (this.log.includes("message")) {
          const target = ev.target as WebSocket;
          console.info("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (this.log.includes("error")) {
          const target = ev.target as WebSocket;
          console.error("Error occurred while updating socket", {
            data: ev.data,
            url: target.url,
            error: err,
          });
        }
      }
    };

    this.instance.onclose = (event: CloseEvent) => {
      this.fetchStatus = "disconnected";

      if (this.#shouldRetry(event)) this.#reconnect();
    };

    this.instance.onerror = (ev: Event) => {
      this.status = "error";

      if (this.log.includes("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };
  };

  #cleanupEventListeners() {
    if (!this.instance) return;

    this.#eventListeners.forEach((listener, event) => {
      this.instance?.removeEventListener(event, listener);
    });

    this.#eventListeners.clear();
  }

  #generateCacheKey = (params: Params) => {
    return getUri({
      baseURL: this.baseURL,
      url: this.url,
      params,
    });
  };

  get data() {
    return this.#state;
  }

  get isLoading() {
    return this.status === "loading";
  }

  open = (params: Params = {} as Params) => {
    if (this.instance) return;

    this.#cleanupEventListeners();
    this.path = this.#generateCacheKey(params);
    this.#connect();
  };

  close = () => {
    if (this.instance?.readyState !== WebSocket.CLOSED) {
      this.instance?.close();
    }

    this.#cleanup();
  };

  send = (payload: Post) => {
    if (this.instance?.readyState === WebSocket.OPEN) {
      this.instance.send(JSON.stringify(payload));
    }
  };

  on = (event: SocketEvent, callback: (ev: Event) => void) => {
    this.instance?.addEventListener(event, callback);
    this.#eventListeners.set(event, callback);
  };
}

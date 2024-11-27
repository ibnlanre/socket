import { SocketCloseCode } from "./constants/socket-close-code";
import { SocketCloseReason } from "./constants/socket-close-reason";
import { getUri } from "./get-uri";

import type { SocketConstructor } from "./types/socket-constructor";
import type { SocketEvent } from "./types/socket-event";
import type { SocketFetchStatus } from "./types/socket-fetch-status";
import type { SocketParams } from "./types/socket-params";
import type { SocketStatus } from "./types/socket-status";
import type { SocketTimeout } from "./types/socket-timeout";

export class SocketClient<
  Get = unknown,
  Params extends SocketParams = {},
  Post = never
> {
  instance: WebSocket | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  status: SocketStatus = "loading";
  path: string = "";

  #log: SocketEvent[];
  #baseURL: string;
  #retry: boolean;
  #retryDelay: number;
  #minJitterValue: number;
  #maxJitterValue: number;
  #retryCount: number;
  #retryOnNetworkRestore: boolean;
  #retryBackoffStrategy: "fixed" | "exponential";
  #maxRetryDelay: number;
  #retryOnSpecificCloseCodes: SocketCloseCode[];
  #currentRetryAttempt = 0;
  #networkRestoreListener: (() => void) | null = null;
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #url: string;

  #eventListeners: Map<string, EventListener> = new Map();
  #timerId: SocketTimeout = undefined;
  #state?: Get;

  constructor({
    log = ["open", "close", "error"],
    baseURL = "",
    retry = false,
    retryDelay = 1000,
    retryCount = 3,
    minJitterValue = 0.8,
    maxJitterValue = 1.2,
    retryOnNetworkRestore = true,
    retryBackoffStrategy = "exponential",
    maxRetryDelay = 30000,
    retryOnSpecificCloseCodes = [
      SocketCloseCode.ABNORMAL_CLOSURE,
      SocketCloseCode.TRY_AGAIN_LATER,
      SocketCloseCode.SERVICE_RESTART,
    ],
    retryOnCustomCondition,
    url,
  }: SocketConstructor) {
    this.#log = log;
    this.#baseURL = baseURL;
    this.#retry = retry;
    this.#retryDelay = retryDelay;
    this.#retryCount = retryCount;
    this.#minJitterValue = minJitterValue;
    this.#maxJitterValue = maxJitterValue;
    this.#retryOnNetworkRestore = retryOnNetworkRestore;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#maxRetryDelay = maxRetryDelay;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#url = url;
  }

  #calculateBackoff(): number {
    switch (this.#retryBackoffStrategy) {
      case "fixed": {
        return Math.min(this.#retryDelay, this.#maxRetryDelay);
      }

      case "exponential": {
        const delay = Math.min(
          this.#retryDelay * Math.pow(2, this.#currentRetryAttempt),
          this.#maxRetryDelay
        );

        const jitterBufferValue = this.#maxJitterValue - this.#minJitterValue;
        const jitterBufferTarget = Math.random() * jitterBufferValue;
        const jitterFactor = this.#minJitterValue + jitterBufferTarget;

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

    if (this.#log.includes("close")) {
      console.info("WebSocket disconnected", {
        url: target.url,
        reason: SocketCloseCode[errorCode],
        explanation: SocketCloseReason[errorCode],
        code: errorCode,
      });
    }

    if (this.#currentRetryAttempt >= this.#retryCount) {
      this.#cleanup();
      return false;
    }

    if (this.#retry) {
      if (this.#retryOnCustomCondition?.(event, target)) return true;
      if (this.#retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    this.#cleanup();
    return false;
  }

  #setupNetworkListener() {
    if (!this.#retryOnNetworkRestore) return;

    this.#networkRestoreListener = () => {
      if (this.fetchStatus === "disconnected") {
        this.#currentRetryAttempt = 0;
        this.#reconnect();
      }
    };

    window.addEventListener("online", this.#networkRestoreListener);
  }

  #cleanupNetworkListener() {
    if (this.#networkRestoreListener) {
      window.removeEventListener("online", this.#networkRestoreListener);
      this.#networkRestoreListener = null;
    }
  }

  #reconnect = () => {
    this.fetchStatus = "idle";

    this.#currentRetryAttempt++;
    const backoffDelay = this.#calculateBackoff();
    this.#timerId = setTimeout(this.#connect, backoffDelay);
  };

  #connect = () => {
    this.instance = new WebSocket(this.path);
    this.fetchStatus = "connecting";

    this.instance.onopen = (ev: Event) => {
      this.#currentRetryAttempt = 0;
      this.#setupNetworkListener();
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
        this.#state = JSON.parse(ev.data);

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

    this.instance.onclose = (event: CloseEvent) => {
      this.fetchStatus = "disconnected";

      if (this.#shouldRetry(event)) this.#reconnect();
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

  #cleanupEventListeners() {
    if (!this.instance) return;

    this.#eventListeners.forEach((listener, event) => {
      this.instance?.removeEventListener(event, listener);
    });

    this.#eventListeners.clear();
  }

  #generateCacheKey = (params: Params) => {
    return getUri({
      baseURL: this.#baseURL,
      url: this.#url,
      params,
    });
  };

  get data() {
    return this.#state;
  }

  get isLoading() {
    return this.status === "loading";
  }

  open = (params: Params) => {
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

import { SocketCloseCode } from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { getUri } from "@/get-uri";
import { SocketCache } from "@/socket-cache";

import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketEvent } from "@/types/socket-event";
import type { SocketFetchStatus } from "@/types/socket-fetch-status";
import type { SocketListener } from "@/types/socket-listener";
import type { SocketParams } from "@/types/socket-params";
import type { SocketStatus } from "@/types/socket-status";
import type { SocketTimeout } from "@/types/socket-timeout";

export class SocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
> {
  cache: SocketCache<Get>;
  ws: WebSocket | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  status: SocketStatus = "idle";
  path: string = "";
  dataUpdatedAt: number = 0;
  error: Error | null = null;
  errorUpdatedAt: number = 0;
  failureCount: number = 0;
  failureReason: string | null = null;

  #log: SocketEvent[];
  #clearCacheOnClose: boolean;
  #retry: boolean;
  #retryDelay: number;
  #minJitterValue: number;
  #maxJitterValue: number;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #reconnectOnNetworkRestore: boolean;
  #reconnectOnWindowFocus: boolean;
  #maxRetryDelay: number;
  #retryOnSpecificCloseCodes: SocketCloseCode[];
  #subscribers: Set<Function> = new Set();
  #eventListeners: Map<string, EventListener> = new Map();
  #networkRestoreListener: (() => void) | null = null;
  #focusListener: (() => void) | null = null;
  #timerId: SocketTimeout = undefined;

  #logCondition: (logType: SocketEvent) => boolean;
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #encryptPayload: (data: Post) => Post;

  constructor(
    {
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      clearCacheOnClose = false,
      baseURL = "",
      retry = false,
      retryDelay = 1000,
      retryCount = 3,
      minJitterValue = 0.8,
      maxJitterValue = 1.2,
      reconnectOnNetworkRestore = true,
      reconnectOnWindowFocus = true,
      retryBackoffStrategy = "exponential",
      maxRetryDelay = 30000,
      retryOnSpecificCloseCodes = [
        SocketCloseCode.ABNORMAL_CLOSURE,
        SocketCloseCode.TRY_AGAIN_LATER,
        SocketCloseCode.SERVICE_RESTART,
      ],
      retryOnCustomCondition,
      encryptPayload = (payload: Post) => payload,
      decryptData = (data: Get) => data,
      url,
    }: SocketConstructor<Get, Post>,
    params = {} as Params
  ) {
    if (retryCount === -1) this.#retryCount = Infinity;

    this.#log = log;
    this.#logCondition = logCondition;
    this.#retry = retry;
    this.#retryDelay = retryDelay;
    this.#retryCount = retryCount;
    this.#minJitterValue = minJitterValue;
    this.#maxJitterValue = maxJitterValue;
    this.#reconnectOnNetworkRestore = reconnectOnNetworkRestore;
    this.#reconnectOnWindowFocus = reconnectOnWindowFocus;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#maxRetryDelay = maxRetryDelay;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#encryptPayload = encryptPayload;
    this.#clearCacheOnClose = clearCacheOnClose;
    this.cache = new SocketCache<Get>(url, decryptData);
    this.path = getUri({ baseURL, url, params });
  }

  #calculateBackoff(): number {
    switch (this.#retryBackoffStrategy) {
      case "fixed": {
        return Math.min(this.#retryDelay, this.#maxRetryDelay);
      }

      case "exponential": {
        const delay = Math.min(
          this.#retryDelay * Math.pow(2, this.failureCount),
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
    clearTimeout(this.#timerId);
    this.#cleanupEventListeners();

    this.failureCount = 0;
    this.failureReason = null;
    this.fetchStatus = "idle";
    this.status = "loading";

    this.#notifySubscribers();
  }

  #shouldLog(event: SocketEvent): boolean {
    if (this.#logCondition(event)) return this.#log.includes(event);
    return false;
  }

  #shouldRetry(event: CloseEvent): boolean {
    const target = event.target as WebSocket;
    const errorCode = event.code as SocketCloseCode;
    const reason = SocketCloseReason[errorCode];

    if (this.#shouldLog("close")) {
      console.info("WebSocket disconnected", {
        url: target.url,
        reason: SocketCloseCode[errorCode],
        explanation: SocketCloseReason[errorCode],
        code: errorCode,
      });
    }

    if (this.#retry && this.failureCount < this.#retryCount) {
      this.failureCount++;
      this.failureReason = event.reason || reason;

      this.#notifySubscribers();

      if (this.#retryOnCustomCondition?.(event, target)) return true;
      if (this.#retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    this.#cleanup();
    return false;
  }

  #setupNetworkListener() {
    if (!this.#reconnectOnNetworkRestore) return;

    this.#networkRestoreListener = () => {
      if (this.fetchStatus === "disconnected") {
        this.open();
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

  #setupWindowFocusListener() {
    if (!this.#reconnectOnWindowFocus) return;

    this.#focusListener = () => {
      if (this.fetchStatus === "disconnected") {
        this.open();
      }
    };

    window.addEventListener("focus", this.#focusListener);
  }

  #cleanupWindowFocusListener() {
    if (this.#focusListener) {
      window.removeEventListener("focus", this.#focusListener);
      this.#focusListener = null;
    }
  }

  #reconnect = () => {
    const backoffDelay = this.#calculateBackoff();
    this.#timerId = setTimeout(this.#connect, backoffDelay);
  };

  #connect = () => {
    this.ws = new WebSocket(this.path);
    this.fetchStatus = "connecting";
    this.status = this.value ? "stale" : "loading";

    this.ws.onopen = (ev: Event) => {
      this.#setupNetworkListener();
      this.#setupWindowFocusListener();

      this.fetchStatus = "connected";
      this.failureCount = 0;
      this.failureReason = null;
      this.error = null;
      this.errorUpdatedAt = 0;

      this.#notifySubscribers();

      if (this.#shouldLog("open")) {
        const target = ev.target as WebSocket;
        console.info("WebSocket connected", {
          url: target.url,
        });
      }
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      this.status = "success";
      this.dataUpdatedAt = Date.now();
      this.#notifySubscribers();

      try {
        this.cache.set(this.path, ev.data);
        this.#notifySubscribers();

        if (this.#shouldLog("message")) {
          const target = ev.target as WebSocket;
          console.info("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (this.#shouldLog("error")) {
          const target = ev.target as WebSocket;
          console.error("Error occurred while updating socket", {
            data: ev.data,
            url: target.url,
            error: err,
          });
        }
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.fetchStatus = "disconnected";
      this.status = "idle";
      this.#notifySubscribers();

      if (event.code === SocketCloseCode.NORMAL_CLOSURE) return;
      if (this.#shouldRetry(event)) this.#reconnect();
    };

    this.ws.onerror = (ev: Event) => {
      this.fetchStatus = "idle";
      this.status = "error";
      this.error = new Error("WebSocket connection error");
      this.errorUpdatedAt = Date.now();
      this.#notifySubscribers();

      if (this.#shouldLog("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };
  };

  #cleanupEventListeners() {
    if (!this.ws) return;

    this.#eventListeners.forEach((listener, event) => {
      this.ws?.removeEventListener(event, listener);
    });

    this.#eventListeners.clear();
  }

  #notifySubscribers = () => {
    this.#subscribers.forEach((listener) => listener({}));
  };

  subscribe = (listener: Function, immediate = true) => {
    if (!this.#subscribers.has(listener)) {
      this.#subscribers.add(listener);
      if (immediate) listener(this);
    }

    return () => {
      this.#subscribers.delete(listener);
    };
  };

  open = () => {
    if (this.ws) return;

    this.#cleanup();
    this.cache.initialize(this.path);
    this.#connect();
  };

  close = () => {
    if (this.ws?.readyState !== WebSocket.CLOSED) this.ws?.close();
    if (this.#clearCacheOnClose) this.cache.remove(this.path);

    this.#cleanup();
    this.#cleanupNetworkListener();
    this.#cleanupWindowFocusListener();
    this.#subscribers.clear();

    this.ws = null;
  };

  send = (payload: Post) => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const data = this.#encryptPayload(payload);
      this.ws.send(JSON.stringify(data));
    }
  };

  on: SocketListener = (event, callback) => {
    this.ws?.addEventListener(event, callback);
    this.#eventListeners.set(event, callback);
  };

  get value() {
    return this.cache.value;
  }

  get isStale(): boolean {
    return this.status === "stale";
  }

  get isPending(): boolean {
    const hasUndefinedValue = typeof this.value == undefined;
    const isLoadingOrIdle = ["idle", "loading"].includes(this.status);
    return isLoadingOrIdle && hasUndefinedValue;
  }

  get isLoading(): boolean {
    return this.status === "loading";
  }

  get isError(): boolean {
    return this.status === "error";
  }

  get isRefetching(): boolean {
    return this.isLoading && this.failureCount > 0;
  }

  get isRefetchError(): boolean {
    return this.isError && this.failureCount > 0;
  }

  get isSuccess(): boolean {
    return this.status === "success";
  }
}

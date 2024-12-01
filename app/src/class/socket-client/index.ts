import { SocketCache } from "@/class/socket-cache";
import { SocketCloseCode } from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { getUri } from "@/functions/get-uri";
import { shallowClone } from "@/functions/shallow-clone";

import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketConnectionEvent } from "@/types/socket-event";
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
  dataUpdatedAt: number = 0;
  error: Error | null = null;
  errorUpdatedAt: number = 0;
  failureCount: number = 0;
  failureReason: string | null = null;
  fetchStatus: SocketFetchStatus = "idle";
  path: string = "";
  placeholderData?: Get;
  status: SocketStatus = "loading";
  value: Get | undefined = undefined;
  ws: WebSocket | null = null;

  #clearCacheOnClose: boolean;
  #encryptPayload: (data: Post) => Post;
  #eventListeners: Map<string, EventListener> = new Map();
  #focusListener: (() => void) | null = null;
  #initialPayload?: Post;
  #log: SocketConnectionEvent[];
  #logCondition: (logType: SocketConnectionEvent) => boolean;
  #retry: boolean;
  #retryDelay: number;
  #minJitterValue: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #networkRestoreListener: (() => void) | null = null;
  #protocols: string | string[];
  #reconnectOnNetworkRestore: boolean;
  #reconnectOnWindowFocus: boolean;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #retryOnSpecificCloseCodes: SocketCloseCode[];
  #subscribers: Set<Function> = new Set();
  #timerId: SocketTimeout = undefined;
  #enabled: boolean;

  constructor(
    {
      baseURL = "",
      clearCacheOnClose = false,
      decryptData = (data: Get) => data,
      disableCache = false,
      enabled = true,
      encryptPayload = (payload: Post) => payload,
      initialPayload,
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      maxCacheAge = 90000,
      maxJitterValue = 1.2,
      maxRetryDelay = 60000,
      minJitterValue = 0.8,
      placeholderData,
      protocols = [],
      reconnectOnNetworkRestore = true,
      reconnectOnWindowFocus = true,
      retry = false,
      retryDelay = 1000,
      retryCount = 3,
      retryBackoffStrategy = "exponential",
      retryOnSpecificCloseCodes = [
        SocketCloseCode.ABNORMAL_CLOSURE,
        SocketCloseCode.TRY_AGAIN_LATER,
        SocketCloseCode.SERVICE_RESTART,
      ],
      retryOnCustomCondition,
      url,
    }: SocketConstructor<Get, Post>,
    params = {} as Params
  ) {
    this.cache = new SocketCache<Get>({
      url,
      decryptData,
      disableCache,
      maxCacheAge,
    });
    this.#clearCacheOnClose = clearCacheOnClose;
    this.#enabled = enabled;
    this.#encryptPayload = encryptPayload;
    this.#initialPayload = initialPayload;
    this.#log = log;
    this.#logCondition = logCondition;
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = maxRetryDelay;
    this.#minJitterValue = minJitterValue;
    this.path = getUri({ baseURL, url, params });
    this.placeholderData = placeholderData;
    this.#protocols = protocols;
    this.#reconnectOnNetworkRestore = reconnectOnNetworkRestore;
    this.#reconnectOnWindowFocus = reconnectOnWindowFocus;
    this.#retry = retry;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#retryCount = retryCount;
    this.#retryDelay = retryDelay;
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;

    if (this.placeholderData) {
      this.#setState({ value: this.placeholderData });
    }
  }

  #calculateBackoff = (): number => {
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
  };

  #cleanup = () => {
    clearTimeout(this.#timerId);

    this.#cleanupEventListeners();
    this.#setState({
      fetchStatus: "idle",
      failureReason: null,
      failureCount: 0,
    });
  };

  #cleanupEventListeners = () => {
    if (!this.ws) return;

    this.#eventListeners.forEach((listener, event) => {
      this.ws?.removeEventListener(event, listener);
    });

    this.#eventListeners.clear();
  };

  #cleanupNetworkListener = () => {
    if (this.#networkRestoreListener) {
      window.removeEventListener("online", this.#networkRestoreListener);
      this.#networkRestoreListener = null;
    }
  };

  #cleanupWindowFocusListener = () => {
    if (this.#focusListener) {
      window.removeEventListener("focus", this.#focusListener);
      this.#focusListener = null;
    }
  };

  #connect = () => {
    this.ws = new WebSocket(this.path, this.#protocols);
    this.#setState({
      fetchStatus: "connecting",
      status: "loading",
    });

    this.ws.onopen = (ev: Event) => {
      if (this.#initialPayload) this.send(this.#initialPayload);

      this.#setState({
        fetchStatus: "connected",
        failureCount: 0,
        failureReason: null,
        error: null,
        errorUpdatedAt: 0,
      });

      if (this.#shouldLog("open")) {
        const target = ev.target as WebSocket;
        console.info("WebSocket connected", {
          url: target.url,
        });
      }
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      this.#setState({
        status: "success",
        dataUpdatedAt: Date.now(),
      });

      try {
        this.cache.set(this.path, ev.data);

        if (this.#shouldLog("message")) {
          const target = ev.target as WebSocket;
          console.log("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (this.#shouldLog("error")) {
          const target = ev.target as WebSocket;

          console.error("WebSocket connection error", {
            data: ev.data,
            url: target.url,
            error: err,
          });
        }
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.#setState({
        fetchStatus: "disconnected",
        status: "idle",
      });

      if (event.code === SocketCloseCode.NORMAL_CLOSURE) return;
      if (this.#shouldRetry(event)) this.#reconnect();
    };

    this.ws.onerror = () => {
      this.#setState({
        status: "error",
        errorUpdatedAt: Date.now(),
        error: new Error("WebSocket connection error"),
      });
    };
  };

  #notifySubscribers = () => {
    const state = shallowClone(this);
    this.#subscribers.forEach((listener) => listener(state));
  };

  #reconnect = () => {
    const backoffDelay = this.#calculateBackoff();
    this.#timerId = setTimeout(this.#connect, backoffDelay);
  };

  #setState = (newState: Partial<SocketClient<Get, Params, Post>>) => {
    for (const key in newState) this[key] = newState[key];
    this.#notifySubscribers();
  };

  #setupNetworkListener = () => {
    if (!this.#reconnectOnNetworkRestore) return;

    this.#networkRestoreListener = () => {
      if (this.isInactive) this.#connect();
    };

    window.addEventListener("online", this.#networkRestoreListener);
  };

  #setValue = (value: Get) => {
    const status = this.isActive ? "success" : "stale";
    this.#setState({ value, status });
  };

  #setupWindowFocusListener = () => {
    if (!this.#reconnectOnWindowFocus) return;

    this.#focusListener = () => {
      if (this.isInactive) this.#connect();
    };

    window.addEventListener("focus", this.#focusListener);
  };

  #shouldLog = (event: SocketConnectionEvent): boolean => {
    if (this.#logCondition(event)) return this.#log.includes(event);
    return false;
  };

  #shouldRetry = (event: CloseEvent): boolean => {
    const target = event.target as WebSocket;
    const errorCode = event.code as SocketCloseCode;
    const reason = SocketCloseReason[errorCode];

    if (this.#shouldLog("close")) {
      console.warn("WebSocket disconnected", {
        url: target.url,
        reason: SocketCloseCode[errorCode],
        explanation: SocketCloseReason[errorCode],
        code: errorCode,
      });
    }

    if (this.#retry && this.failureCount < this.#retryCount) {
      this.#setState({
        failureCount: this.failureCount,
        failureReason: event.reason || reason,
      });

      if (this.#retryOnCustomCondition?.(event, target)) return true;
      if (this.#retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    this.#cleanup();
    return false;
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

  on: SocketListener = (event, callback) => {
    this.ws?.addEventListener(event, callback);
    this.#eventListeners.set(event, callback);
  };

  open = () => {
    if (!this.#enabled) return;
    if (this.ws) return;

    this.#cleanup();
    this.cache.subscribe(this.#setValue);
    this.cache.initialize(this.path);

    this.#setupNetworkListener();
    this.#setupWindowFocusListener();
    this.#connect();
  };

  send = (payload: Post) => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const data = this.#encryptPayload(payload);
      this.ws.send(JSON.stringify(data));
    }
  };

  subscribe = (listener: Function, immediate = true) => {
    if (!this.#subscribers.has(listener)) {
      if (immediate) listener(this);
      this.#subscribers.add(listener);
    }

    return () => {
      this.#subscribers.delete(listener);
    };
  };

  get isError(): boolean {
    return this.status === "error";
  }

  get isLoading(): boolean {
    return this.status === "loading";
  }

  get isPending(): boolean {
    if (this.isPlaceholderData) return true;
    return this.value === undefined;
  }

  get isRefetchError(): boolean {
    return this.isError && this.failureCount > 0;
  }

  get isRefetching(): boolean {
    return this.isLoading && this.failureCount > 0;
  }

  get isSuccess(): boolean {
    return this.status === "success";
  }

  get isActive(): boolean {
    return this.fetchStatus === "connected";
  }

  get isInactive(): boolean {
    return ["disconnected", "idle"].includes(this.fetchStatus);
  }

  get isStaleData(): boolean {
    return this.status === "stale";
  }

  get isPlaceholderData(): boolean {
    return this.value === this.placeholderData;
  }
}

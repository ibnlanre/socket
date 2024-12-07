import { SocketCache } from "@/class/socket-cache";
import { SocketCloseCode } from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { extractOrigin } from "@/functions/extract-origin";
import { extractPathname } from "@/functions/extract-pathname";
import { shallowClone } from "@/functions/shallow-clone";
import { toMs } from "@/functions/to-ms";
import { getUri } from "@/library/get-uri";

import type { SocketCipher } from "@/types/socket-cipher";
import type { SocketConstructor } from "@/types/socket-constructor";
import type { SocketConnectionEvent } from "@/types/socket-event";
import type { SocketFetchStatus } from "@/types/socket-fetch-status";
import type { SocketListener } from "@/types/socket-listener";
import type { SocketParams } from "@/types/socket-params";
import type { SocketStatus } from "@/types/socket-status";
import type { UnitValue } from "@/types/socket-time-unit";
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
  isPlaceholderData: boolean = false;
  path: string = "";
  status: SocketStatus = "loading";
  value: Get | undefined = undefined;
  ws: WebSocket | null = null;

  #clearCacheOnClose: boolean;
  #encrypt?: SocketCipher;
  #encryptPayload: boolean;
  #eventListeners: Map<string, EventListener> = new Map();
  #focusListener: (() => void) | null = null;
  #href: string;
  #idleConnectionTimeout: number;
  #idleConnectionTimerId: SocketTimeout = undefined;
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
  #reconnectionTimerId: SocketTimeout = undefined;
  #enabled: boolean;

  constructor(
    {
      baseURL = "",
      cacheKey,
      clearCacheOnClose = false,
      decrypt,
      decryptData = true,
      disableCache = false,
      enabled = true,
      encrypt,
      encryptPayload = true,
      idleConnectionTimeout = "5 minutes",
      initialPayload,
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      maxCacheAge = "15 minutes",
      maxJitterValue = 1.2,
      maxRetryDelay = "1 minute",
      minJitterValue = 0.8,
      placeholderData,
      protocols = [],
      reconnectOnNetworkRestore = true,
      reconnectOnWindowFocus = true,
      retry = false,
      retryDelay = "5 seconds",
      retryCount = 3,
      retryBackoffStrategy = "exponential",
      retryOnSpecificCloseCodes = [
        SocketCloseCode.ABNORMAL_CLOSURE,
        SocketCloseCode.TRY_AGAIN_LATER,
        SocketCloseCode.SERVICE_RESTART,
      ],
      retryOnCustomCondition,
      setStateAction,
      url,
    }: SocketConstructor<Get, Post>,
    params = {} as Params
  ) {
    this.#clearCacheOnClose = clearCacheOnClose;
    this.#enabled = enabled;
    this.#encrypt = encrypt;
    this.#encryptPayload = encryptPayload;
    this.#href = getUri({ baseURL, url, params });
    this.#idleConnectionTimeout = toMs(idleConnectionTimeout);
    this.#initialPayload = initialPayload;
    this.#log = log;
    this.#logCondition = logCondition;
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = toMs(maxRetryDelay);
    this.#minJitterValue = minJitterValue;
    this.path = extractPathname(this.#href);
    this.#protocols = protocols;
    this.#reconnectOnNetworkRestore = reconnectOnNetworkRestore;
    this.#reconnectOnWindowFocus = reconnectOnWindowFocus;
    this.#retry = retry;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#retryCount = retryCount;
    this.#retryDelay = toMs(retryDelay);
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;

    const origin = cacheKey ?? extractOrigin(this.#href);
    this.cache = new SocketCache<Get>({
      decrypt,
      decryptData,
      disableCache,
      encrypt,
      maxCacheAge: toMs(maxCacheAge),
      origin,
      setStateAction,
    });

    if (placeholderData) {
      this.#setState({ value: placeholderData, isPlaceholderData: true });
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
    clearTimeout(this.#reconnectionTimerId);

    this.#cleanupEventListeners();
    this.#setState({
      fetchStatus: "idle",
      failureReason: null,
      failureCount: 0,
      error: null,
      errorUpdatedAt: 0,
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
    this.ws = new WebSocket(this.#href, this.#protocols);
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
      if (event.wasClean) return this.#cleanup();
      if (this.#shouldRetryOnClose(event)) this.#reconnect();
    };

    this.ws.onerror = (event: Event) => {
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
    this.#reconnectionTimerId = setTimeout(this.#connect, backoffDelay);
  };

  #setState = (newState: Partial<SocketClient<Get, Params, Post>>) => {
    for (const key in newState) this[key] = newState[key];
    this.#notifySubscribers();
  };

  #setupNetworkListener = () => {
    if (!this.#reconnectOnNetworkRestore) return;

    this.#networkRestoreListener = () => {
      if (this.isIdle) this.#connect();
    };

    window.addEventListener("online", this.#networkRestoreListener);
  };

  #setValue = (value: Get) => {
    const status = this.isConnected ? "success" : "stale";
    this.#setState({ value, status, isPlaceholderData: false });
  };

  #setupWindowFocusListener = () => {
    if (!this.#reconnectOnWindowFocus) return;

    this.#focusListener = () => {
      if (this.isIdle) this.#connect();
    };

    window.addEventListener("focus", this.#focusListener);
  };

  #shouldLog = (event: SocketConnectionEvent): boolean => {
    if (this.#logCondition(event)) return this.#log.includes(event);
    return false;
  };

  #shouldRetryOnClose = (event: CloseEvent): boolean => {
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
        fetchStatus: "disconnected",
        failureReason: event.reason || reason,
        failureCount: this.failureCount + 1,
        status: "idle",
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
      if (this.#encryptPayload && this.#encrypt) {
        payload = this.#encrypt(payload) as Post;
      }

      this.ws.send(JSON.stringify(payload));
    }
  };

  subscribe = (listener: Function, immediate = true) => {
    clearTimeout(this.#idleConnectionTimerId);

    if (!this.#subscribers.has(listener)) {
      if (immediate) listener(this);
      this.#subscribers.add(listener);
    }

    return () => {
      this.#subscribers.delete(listener);

      if (this.#subscribers.size === 0) {
        this.#idleConnectionTimerId = setTimeout(
          this.close,
          this.#idleConnectionTimeout
        );
      }
    };
  };

  waitUntil(
    state: SocketConnectionEvent,
    timeout: UnitValue = "5 seconds"
  ): Promise<void> {
    let timerId: SocketTimeout;

    return new Promise((resolve, reject) => {
      const handleClearTimeout = () => {
        clearTimeout(timerId);
        this.ws?.removeEventListener(state, handleResolution);
      };

      const handleResolution = () => {
        resolve();
        handleClearTimeout();
      };

      this.ws?.addEventListener(state, handleResolution, { once: true });

      const handleRejection = () => {
        handleClearTimeout();
        const message = `WebSocket did not reach state "${state}" within ${timeout}ms.`;
        reject(new Error(message));
      };

      timerId = setTimeout(handleRejection, toMs(timeout));
    });
  }

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

  get isConnected(): boolean {
    return this.fetchStatus === "connected";
  }

  get isConnecting(): boolean {
    return this.fetchStatus === "connecting";
  }

  get isDisconnected(): boolean {
    return this.fetchStatus === "disconnected";
  }

  get isIdle(): boolean {
    return this.fetchStatus === "idle";
  }

  get isStaleData(): boolean {
    return this.status === "stale";
  }
}

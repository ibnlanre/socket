import { Component } from "react";

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

type SocketState<Get> = {
  cache: SocketCache<Get>;
  dataUpdatedAt: number;
  error: Error | null;
  errorUpdatedAt: number;
  failureCount: number;
  failureReason: string | null;
  fetchStatus: SocketFetchStatus;
  path: string;
  status: SocketStatus;
  ws: WebSocket | null;
};

export class SocketClient<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
> extends Component<{}, SocketState<Get>> {
  #clearCacheOnClose: boolean;
  #eventListeners: Map<string, EventListener> = new Map();
  #focusListener: (() => void) | null = null;
  #log: SocketEvent[];
  #retry: boolean;
  #retryDelay: number;
  #minJitterValue: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #networkRestoreListener: (() => void) | null = null;
  #reconnectOnNetworkRestore: boolean;
  #reconnectOnWindowFocus: boolean;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #retryOnSpecificCloseCodes: SocketCloseCode[];
  #subscribers: Set<Function> = new Set();
  #timerId: SocketTimeout = undefined;

  #encryptPayload: (data: Post) => Post;
  #logCondition: (logType: SocketEvent) => boolean;
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;

  constructor(
    {
      baseURL = "",
      clearCacheOnClose = false,
      decryptData = (data: Get) => data,
      encryptPayload = (payload: Post) => payload,
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      minJitterValue = 0.8,
      maxJitterValue = 1.2,
      maxRetryDelay = 30000,
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
    super({});

    this.state = {
      cache: new SocketCache<Get>(url, decryptData),
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle",
      path: getUri({ baseURL, url, params }),
      status: "idle",
      ws: null,
    };

    if (retryCount === -1) this.#retryCount = Infinity;

    this.#clearCacheOnClose = clearCacheOnClose;
    this.#encryptPayload = encryptPayload;
    this.#log = log;
    this.#logCondition = logCondition;
    this.#minJitterValue = minJitterValue;
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = maxRetryDelay;
    this.#reconnectOnNetworkRestore = reconnectOnNetworkRestore;
    this.#reconnectOnWindowFocus = reconnectOnWindowFocus;
    this.#retry = retry;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#retryCount = retryCount;
    this.#retryDelay = retryDelay;
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;
  }

  #calculateBackoff(): number {
    switch (this.#retryBackoffStrategy) {
      case "fixed": {
        return Math.min(this.#retryDelay, this.#maxRetryDelay);
      }

      case "exponential": {
        const delay = Math.min(
          this.#retryDelay * Math.pow(2, this.state.failureCount),
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

    this.setState({
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle",
      status: "loading",
    });
  }

  #cleanupEventListeners() {
    if (!this.state.ws) return;

    this.#eventListeners.forEach((listener, event) => {
      this.state.ws?.removeEventListener(event, listener);
    });

    this.#eventListeners.clear();
  }

  #cleanupNetworkListener() {
    if (this.#networkRestoreListener) {
      window.removeEventListener("online", this.#networkRestoreListener);
      this.#networkRestoreListener = null;
    }
  }

  #cleanupWindowFocusListener() {
    if (this.#focusListener) {
      window.removeEventListener("focus", this.#focusListener);
      this.#focusListener = null;
    }
  }

  #connect = () => {
    const ws = new WebSocket(this.state.path);

    this.setState({
      fetchStatus: "connecting",
      status: this.value ? "stale" : "loading",
    });

    ws.onopen = (ev: Event) => {
      this.#setupNetworkListener();
      this.#setupWindowFocusListener();

      this.setState({
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

    ws.onmessage = (ev: MessageEvent) => {
      this.setState({
        status: "success",
        dataUpdatedAt: Date.now(),
      });

      try {
        this.state.cache.set(this.state.path, ev.data);
        this.forceUpdate();

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

    ws.onclose = (event: CloseEvent) => {
      this.setState({
        fetchStatus: "disconnected",
        status: "idle",
      });

      if (event.code === SocketCloseCode.NORMAL_CLOSURE) return;
      if (this.#shouldRetry(event)) this.#reconnect();
    };

    ws.onerror = (ev: Event) => {
      this.setState({
        fetchStatus: "idle",
        status: "error",
        error: new Error("WebSocket connection error"),
        errorUpdatedAt: Date.now(),
      });

      if (this.#shouldLog("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };

    this.setState({ ws });
  };

  #reconnect = () => {
    const backoffDelay = this.#calculateBackoff();
    this.#timerId = setTimeout(this.#connect, backoffDelay);
  };

  #setupNetworkListener() {
    if (!this.#reconnectOnNetworkRestore) return;

    this.#networkRestoreListener = () => {
      if (this.state.fetchStatus === "disconnected") {
        this.open();
      }
    };

    window.addEventListener("online", this.#networkRestoreListener);
  }

  #setupWindowFocusListener() {
    if (!this.#reconnectOnWindowFocus) return;

    this.#focusListener = () => {
      if (this.state.fetchStatus === "disconnected") {
        this.open();
      }
    };

    window.addEventListener("focus", this.#focusListener);
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

    if (this.#retry && this.state.failureCount < this.#retryCount) {
      this.setState((prevState) => ({
        failureCount: prevState.failureCount + 1,
        failureReason: event.reason || reason,
      }));

      if (this.#retryOnCustomCondition?.(event, target)) return true;
      if (this.#retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    this.#cleanup();
    return false;
  }

  close = () => {
    if (this.state.ws?.readyState !== WebSocket.CLOSED) this.state.ws?.close();
    if (this.#clearCacheOnClose) this.state.cache.remove(this.state.path);

    this.#cleanup();
    this.#cleanupNetworkListener();
    this.#cleanupWindowFocusListener();
    this.#subscribers.clear();

    this.setState({ ws: null });
  };

  on: SocketListener = (event, callback) => {
    this.state.ws?.addEventListener(event, callback);
    this.#eventListeners.set(event, callback);
  };

  open = () => {
    if (this.state.ws) return;

    this.#cleanup();
    this.state.cache.initialize(this.state.path);
    this.#connect();
  };

  send = (payload: Post) => {
    if (this.state.ws?.readyState === WebSocket.OPEN) {
      const data = this.#encryptPayload(payload);
      this.state.ws.send(JSON.stringify(data));
    }
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

  get isError(): boolean {
    return this.state.status === "error";
  }

  get isLoading(): boolean {
    return this.state.status === "loading";
  }

  get isPending(): boolean {
    const hasUndefinedValue = typeof this.value == undefined;
    const isLoadingOrIdle = ["idle", "loading"].includes(this.state.status);
    return isLoadingOrIdle && hasUndefinedValue;
  }

  get isRefetchError(): boolean {
    return this.isError && this.state.failureCount > 0;
  }

  get isRefetching(): boolean {
    return this.isLoading && this.state.failureCount > 0;
  }

  get isStale(): boolean {
    return this.state.status === "stale";
  }

  get isSuccess(): boolean {
    return this.state.status === "success";
  }

  get value() {
    return this.state.cache.value;
  }
}

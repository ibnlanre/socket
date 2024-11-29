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
import type { Dispatch, SetStateAction } from "react";

export type SocketState<Get, Post> = {
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
  value: Get | undefined;
  get isStale(): boolean;
  get isSuccess(): boolean;
  get isLoading(): boolean;
  get isError(): boolean;
  get isRefetching(): boolean;
  get isRefetchError(): boolean;
  close: () => void;
  on: SocketListener;
  open: () => void;
  send: (payload: Post) => void;
  subscribe: (
    listener: Dispatch<SetStateAction<SocketState<Get, Post>>>,
    immediate?: boolean
  ) => () => void;
};

export function createSocket<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never
>(
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
  let state: SocketState<Get, Post> = {
    cache: new SocketCache<Get>(url, decryptData),
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: "idle",
    path: getUri({ baseURL, url, params }),
    status: "idle",
    value: undefined,
    ws: null,
    get isError() {
      return state.status === "error";
    },
    get isLoading() {
      return state.status === "loading";
    },
    get isRefetchError(): boolean {
      return state.isError && state.failureCount > 0;
    },
    get isRefetching(): boolean {
      return state.isLoading && state.failureCount > 0;
    },
    get isStale(): boolean {
      return state.status === "stale";
    },
    get isSuccess(): boolean {
      return state.status === "success";
    },
    close: () => {
      if (state.ws?.readyState !== WebSocket.CLOSED) state.ws?.close();
      if (clearCacheOnClose) state.cache.remove(state.path);

      cleanup();
      cleanupNetworkListener();
      cleanupWindowFocusListener();
      subscribers.clear();

      state.ws = null;
    },
    on: (event, callback) => {
      state.ws?.addEventListener(event, callback);
      eventListeners.set(event, callback);
    },
    open: () => {
      if (state.ws) return;

      cleanup();
      state.cache.initialize(state.path);
      connect();
    },
    send: (payload) => {
      if (state.ws?.readyState === WebSocket.OPEN) {
        const data = encryptPayload(payload);
        state.ws.send(JSON.stringify(data));
      }
    },
    subscribe: (listener, immediate = true) => {
      if (!subscribers.has(listener)) {
        subscribers.add(listener);
        if (immediate) listener(state);
      }

      return () => {
        subscribers.delete(listener);
      };
    },
  };

  function setState(newState: Partial<typeof state>) {
    state = { ...state, ...newState };
    notifySubscribers(state);
  }

  const eventListeners: Map<string, EventListener> = new Map();

  let networkRestoreListener: (() => void) | null = null;
  let focusListener: (() => void) | null = null;

  const subscribers: Set<Dispatch<SetStateAction<typeof state>>> = new Set();
  let timerId: SocketTimeout = undefined;

  const calculateBackoff = (): number => {
    switch (retryBackoffStrategy) {
      case "fixed": {
        return Math.min(retryDelay, maxRetryDelay);
      }

      case "exponential": {
        const delay = Math.min(
          retryDelay * Math.pow(2, state.failureCount),
          maxRetryDelay
        );

        const jitterBufferValue = maxJitterValue - minJitterValue;
        const jitterBufferTarget = Math.random() * jitterBufferValue;
        const jitterFactor = minJitterValue + jitterBufferTarget;

        return delay * jitterFactor;
      }
    }
  };

  const cleanup = () => {
    clearTimeout(timerId);
    cleanupEventListeners();

    setState({
      failureCount: 0,
      failureReason: null,
      fetchStatus: "idle",
      status: "loading",
    });
  };

  const cleanupEventListeners = () => {
    if (!state.ws) return;

    eventListeners.forEach((listener, event) => {
      state.ws?.removeEventListener(event, listener);
    });

    eventListeners.clear();
  };

  const cleanupNetworkListener = () => {
    if (!networkRestoreListener) return;
    window.removeEventListener("online", networkRestoreListener);
  };

  const cleanupWindowFocusListener = () => {
    if (!focusListener) return;
    window.removeEventListener("focus", focusListener);
  };

  const connect = () => {
    const ws = new WebSocket(state.path);
    setupNetworkListener();
    setupWindowFocusListener();

    setState({
      fetchStatus: "connecting",
      status: state.value ? "stale" : "loading",
    });

    ws.onopen = (ev: Event) => {
      setState({
        fetchStatus: "connected",
        failureCount: 0,
        failureReason: null,
        error: null,
        errorUpdatedAt: 0,
      });

      if (shouldLog("open")) {
        const target = ev.target as WebSocket;
        console.info("WebSocket connected", {
          url: target.url,
        });
      }
    };

    ws.onmessage = (ev: MessageEvent) => {
      setState({
        status: "success",
        dataUpdatedAt: Date.now(),
      });

      try {
        state.cache.set(state.path, ev.data);
        setState({
          value: state.cache.value,
        });

        if (shouldLog("message")) {
          const target = ev.target as WebSocket;
          console.info("WebSocket message received", {
            data: ev.data,
            url: target.url,
          });
        }
      } catch (err) {
        if (shouldLog("error")) {
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
      setState({
        fetchStatus: "disconnected",
        status: "idle",
      });

      if (event.code === SocketCloseCode.NORMAL_CLOSURE) return;
      if (shouldRetry(event)) reconnect();
    };

    ws.onerror = (ev: Event) => {
      setState({
        fetchStatus: "idle",
        status: "error",
        error: new Error("WebSocket connection error"),
        errorUpdatedAt: Date.now(),
      });

      if (shouldLog("error")) {
        const target = ev.target as WebSocket;
        console.error("WebSocket error", {
          url: target.url,
          error: ev,
        });
      }
    };

    setState({ ws });
  };

  const notifySubscribers = (newState: typeof state) => {
    subscribers.forEach((listener) => listener(newState));
  };

  const reconnect = () => {
    const backoffDelay = calculateBackoff();
    timerId = setTimeout(connect, backoffDelay);
  };

  const setupNetworkListener = () => {
    if (!reconnectOnNetworkRestore) return;

    networkRestoreListener = () => {
      if (state.fetchStatus === "disconnected") open();
    };

    window.addEventListener("online", networkRestoreListener);
  };

  const setupWindowFocusListener = () => {
    if (!reconnectOnWindowFocus) return;

    focusListener = () => {
      if (state.fetchStatus === "disconnected") open();
    };

    window.addEventListener("focus", focusListener);
  };

  const shouldLog = (event: SocketEvent): boolean => {
    if (logCondition(event)) return log.includes(event);
    return false;
  };

  const shouldRetry = (event: CloseEvent): boolean => {
    const target = event.target as WebSocket;
    const errorCode = event.code as SocketCloseCode;
    const reason = SocketCloseReason[errorCode];

    if (shouldLog("close")) {
      console.info("WebSocket disconnected", {
        url: target.url,
        reason: SocketCloseCode[errorCode],
        explanation: SocketCloseReason[errorCode],
        code: errorCode,
      });
    }

    if (retry && state.failureCount < retryCount) {
      setState({
        failureCount: state.failureCount++,
        failureReason: event.reason || reason,
      });

      if (retryOnCustomCondition?.(event, target)) return true;
      if (retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    cleanup();
    return false;
  };
}

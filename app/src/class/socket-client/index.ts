import { SocketCache } from "@/class/socket-cache";
import {
  SocketCloseCode,
  type SocketCode,
} from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { arrayBufferToBlob } from "@/functions/array-buffer-to-blob";
import { blobToJson } from "@/functions/blob-to-json";
import { extractOrigin } from "@/functions/extract-origin";
import { extractPathname } from "@/functions/extract-pathname";
import { paramsSerializer } from "@/functions/params-serializer";
import { shallowClone } from "@/functions/shallow-clone";
import { time } from "@/functions/time";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { SocketCipher } from "@/types/socket/cipher";
import type { SocketClientSubscriber } from "@/types/socket/client-subscriber";
import type { SocketConnectionEvent } from "@/types/socket/connection-event";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { SocketData } from "@/types/socket/data";
import type {
  SocketMessageFailureAction,
  SocketMessageFailurePolicy,
} from "@/types/socket/data-handling-options";
import type { SocketFetchStatus } from "@/types/socket/fetch-status";
import type { SocketListener } from "@/types/socket/listener";
import type { SocketStatus } from "@/types/socket/status";
import type { SocketTimeout } from "@/types/socket/timeout";
import type { UnitValue } from "@/types/time-unit";

type SocketMessageFailureStage = keyof Required<SocketMessageFailurePolicy>;
type SocketMessageFailure = Error & {
  closeCode: SocketCloseCode;
  stage: SocketMessageFailureStage;
};

export class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
> {
  binaryType: "blob" | "arraybuffer" = "blob";
  cache: SocketCache<Get>;
  dataUpdatedAt: number = 0;
  error: Error | null = null;
  errorTimeout: number = 0;
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
  #log: SocketConnectionEvent[];
  #logCondition: (logType: SocketConnectionEvent) => boolean;
  #retry: boolean;
  #retryDelay: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #minJitterValue: number;
  #networkRestoreListener: (() => void) | null = null;
  #protocols: string | string[];
  #reconnectOnNetworkRestore: boolean;
  #reconnectOnWindowFocus: boolean;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #retryOnSpecificCloseCodes: SocketCode[];
  #subscribers: Set<SocketClientSubscriber<Get, Post, Params>> = new Set();
  #reconnectionTimerId: SocketTimeout = undefined;
  #messageSchema?: SocketConstructor<Get, Post, Params>["messageSchema"];
  #messageFailurePolicy: Required<SocketMessageFailurePolicy>;
  #deduplicationWindow: number;
  #preserveTerminalMetadata: boolean = false;
  /**
   * Unified outbound queue and deduplication registry.
   * sentAt === 0  → payload is queued, waiting for the socket to open.
   * sentAt  > 0  → payload was dispatched at that timestamp; used for dedup.
   */
  #sends: Map<string, { payload: Post; sentAt: number }> = new Map();
  #sendSchema?: SocketConstructor<Get, Post, Params>["sendSchema"];

  constructor(
    {
      baseURL = "",
      binaryType = "blob",
      cacheKey,
      clearCacheOnClose = false,
      decrypt,
      decryptData = true,
      deduplicationWindow = 0,
      disableCache = false,
      encrypt,
      encryptPayload = true,
      idleConnectionTimeout = "5 minutes",
      messageFailurePolicy,
      messageSchema,
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      maxCacheAge = "15 minutes",
      maxJitterValue = 1.2,
      maxRetryDelay = "1 minute",
      minJitterValue = 0.8,
      sendSchema,
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
    }: SocketConstructor<Get, Post, Params>,
    params = {} as Params
  ) {
    this.binaryType = binaryType;
    this.#clearCacheOnClose = clearCacheOnClose;
    this.#deduplicationWindow = time(deduplicationWindow);
    this.#encrypt = encrypt;
    this.#encryptPayload = encryptPayload;
    this.#href = getUri({ baseURL, url, params });
    this.#idleConnectionTimeout = time(idleConnectionTimeout);
    this.#messageSchema = messageSchema;
    this.#messageFailurePolicy = {
      decode: "close",
      parse: "recover",
      validation: "recover",
      ...messageFailurePolicy,
    };
    this.#log = log;
    this.#logCondition = logCondition;
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = time(maxRetryDelay);
    this.#minJitterValue = minJitterValue;
    this.#sendSchema = sendSchema;
    this.path = extractPathname(this.#href);
    this.#protocols = protocols;
    this.#reconnectOnNetworkRestore = reconnectOnNetworkRestore;
    this.#reconnectOnWindowFocus = reconnectOnWindowFocus;
    this.#retry = retry;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#retryCount = retryCount;
    this.#retryDelay = time(retryDelay);
    this.#retryOnCustomCondition = retryOnCustomCondition;
    this.#retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;

    const origin = cacheKey ?? extractOrigin(this.#href);
    this.cache = new SocketCache<Get>({
      decrypt,
      decryptData,
      disableCache,
      encrypt,
      maxCacheAge: time(maxCacheAge),
      origin,
      setStateAction,
    });

    if (placeholderData !== undefined) {
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

  #cleanup = ({
    preserveError = false,
    preserveFailure = false,
  }: {
    preserveError?: boolean;
    preserveFailure?: boolean;
  } = {}) => {
    clearTimeout(this.#reconnectionTimerId);

    this.#cleanupEventListeners();
    this.#preserveTerminalMetadata = false;
    this.#setState({
      fetchStatus: "idle",
      ...(preserveFailure
        ? {}
        : {
            failureReason: null,
            failureCount: 0,
          }),
      ...(preserveError
        ? {}
        : {
            error: null,
            errorUpdatedAt: 0,
          }),
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
      window.removeEventListener("focus", this.#focusListener, true);
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
      this.#flushPendingPayloads();

      this.#setState({
        binaryType: this.binaryType,
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

    this.ws.onmessage = async (ev: MessageEvent) => {
      try {
        await this.#saveData(ev);

        this.#setState({
          status: "success",
          dataUpdatedAt: Date.now(),
          error: null,
          errorUpdatedAt: 0,
        });

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

        const error = err instanceof Error ? err : new Error(String(err));

        this.#setState({
          status: "error",
          error,
          errorUpdatedAt: Date.now(),
        });

        if (this.#getMessageFailureAction(error) === "close") {
          const closeCode = this.#getMessageFailureCode(error);

          this.#preserveTerminalMetadata = true;
          this.#setState({
            failureReason: SocketCloseReason[closeCode] ?? error.message,
            failureCount: this.failureCount + 1,
          });

          this.ws?.close();
        }
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.ws = null;
      clearTimeout(this.#reconnectionTimerId);
      this.#setState({ fetchStatus: "disconnected" });

      if (this.#clearCacheOnClose) {
        this.cache.remove(this.path);
      }

      if (event.wasClean) {
        return this.#cleanup({
          preserveError: this.#preserveTerminalMetadata,
          preserveFailure: this.#preserveTerminalMetadata,
        });
      }

      if (this.#shouldRetryOnClose(event)) {
        this.#reconnect();
        return;
      }

      this.#cleanup({
        preserveError: this.#preserveTerminalMetadata,
        preserveFailure: this.#preserveTerminalMetadata,
      });
    };

    this.ws.onerror = (event: Event) => {
      this.#setState({
        status: "error",
        errorUpdatedAt: Date.now(),
        error: new Error("WebSocket connection error"),
        errorTimeout: event.timeStamp,
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

  #decodeMessageData = async (data: SocketData["data"]): Promise<string> => {
    try {
      if (data instanceof ArrayBuffer) data = arrayBufferToBlob(data);
      if (data instanceof Blob) return await blobToJson(data);
      if (typeof data === "string") return data;
    } catch (error) {
      throw this.#createMessageFailure(error, "decode");
    }

    throw this.#createMessageFailure(
      new Error("Unsupported WebSocket payload type"),
      "decode"
    );
  };

  #saveData = async ({ data }: SocketData) => {
    const payload = this.#parseMessage(await this.#decodeMessageData(data));
    this.cache.set(this.path, payload);
  };

  #parseMessage = (payload: string): string => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw this.#createMessageFailure(error, "parse");
    }

    if (!this.#messageSchema) return JSON.stringify(parsed);

    const result = this.#messageSchema.safeParse(parsed);
    if (result.success) return JSON.stringify(result.data);

    throw this.#createMessageFailure(
      new Error(result.error.message),
      "validation"
    );
  };

  #createMessageFailure = (
    error: unknown,
    stage: SocketMessageFailureStage
  ): SocketMessageFailure => {
    const failure = error instanceof Error ? error : new Error(String(error));

    const closeCode =
      stage === "validation"
        ? SocketCloseCode.POLICY_VIOLATION
        : SocketCloseCode.INVALID_PAYLOAD_DATA;

    return Object.assign(failure, {
      closeCode,
      stage,
    });
  };

  #getMessageFailureCode = (error: Error): SocketCloseCode => {
    if (this.#isMessageFailure(error)) return error.closeCode;
    return SocketCloseCode.INVALID_PAYLOAD_DATA;
  };

  #getMessageFailureAction = (error: Error): SocketMessageFailureAction => {
    if (!this.#isMessageFailure(error)) return "recover";
    return this.#messageFailurePolicy[error.stage];
  };

  #isMessageFailure = (error: Error): error is SocketMessageFailure => {
    return "closeCode" in error && "stage" in error;
  };

  #dispatchPayload = (payload: Post) => {
    if (this.#encryptPayload && this.#encrypt) {
      payload = this.#encrypt(payload) as Post;
    }

    this.ws?.send(JSON.stringify(payload));
  };

  #flushPendingPayloads = () => {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();

    for (const [key, { sentAt, payload }] of this.#sends) {
      if (sentAt > 0) continue;
      this.#dispatchPayload(payload);
      this.#sends.set(key, { payload, sentAt: now });
    }
  };

  #setState = (newState: Partial<SocketClient<Get, Post, Params>>) => {
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

    window.addEventListener("focus", this.#focusListener, true);
  };

  #shouldLog = (event: SocketConnectionEvent): boolean => {
    if (this.#logCondition(event)) return this.#log.includes(event);
    return false;
  };

  #shouldRetryOnClose = (event: CloseEvent): boolean => {
    const target = event.target as WebSocket;
    const errorCode = event.code as SocketCloseCode;
    const reason =
      event.reason || SocketCloseReason[errorCode] || "Socket closed";

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
        failureReason: reason,
        failureCount: this.failureCount + 1,
        status: "idle",
      });

      if (this.#retryOnCustomCondition?.(event, target)) return true;
      if (this.#retryOnSpecificCloseCodes.includes(errorCode)) return true;
    }

    if (!event.wasClean) {
      this.#preserveTerminalMetadata = true;
      this.#setState({
        status: "error",
        failureReason: reason,
        failureCount: this.failureCount + 1,
        error: this.error ?? new Error(reason),
        errorUpdatedAt: this.errorUpdatedAt || Date.now(),
      });
    }

    return false;
  };

  close = () => {
    const code = SocketCloseCode.NORMAL_CLOSURE;
    const reason = SocketCloseReason[code];

    if (this.ws?.readyState !== WebSocket.CLOSED) this.ws?.close(code, reason);
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

  open = (enabled: boolean = true) => {
    if (!enabled || this.ws) return;

    this.#cleanup();
    this.cache.subscribe(this.#setValue);

    this.#setupNetworkListener();
    this.#setupWindowFocusListener();

    void this.cache.initialize(this.path).finally(() => {
      if (this.ws || this.#subscribers.size === 0) return;
      this.#connect();
    });
  };

  send = (payload: Post): boolean => {
    payload = this.#parseSendPayload(payload);

    const window = this.#deduplicationWindow;
    const key = paramsSerializer(payload as ConnectionParams);
    const now = Date.now();

    const { sentAt = 0 } = { ...this.#sends.get(key) };
    if (window > 0 && now - sentAt < window) return false;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.#dispatchPayload(payload);
      this.#sends.set(key, { payload, sentAt: now });
    } else {
      // Queue: new entries are appended; expired entries are moved to the end
      // so they flush in the order they were re-requested.
      if (sentAt > 0) this.#sends.delete(key);
      this.#sends.set(key, { payload, sentAt: 0 });
    }

    return true;
  };

  #parseSendPayload = (payload: Post): Post => {
    if (!this.#sendSchema) return payload;

    const result = this.#sendSchema.safeParse(payload);
    if (result.success) return result.data;

    throw new Error(result.error.message);
  };

  subscribe = (
    listener: (client: SocketClient<Get, Post, Params>) => void,
    immediate = true
  ) => {
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

  waitUntil = (
    state: SocketConnectionEvent,
    timeout: UnitValue = "5 seconds"
  ): Promise<void> => {
    let timerId: SocketTimeout;

    const hasReachedState = () => {
      switch (state) {
        case "open":
          return this.isConnected;
        case "message":
          return this.isSuccess;
        case "close":
          return this.isIdle || this.isDisconnected || this.ws === null;
        case "error":
          return this.isError;
      }
    };

    return new Promise((resolve, reject) => {
      if (hasReachedState()) {
        resolve();
        return;
      }

      const handleClearTimeout = () => {
        clearTimeout(timerId);
        this.ws?.removeEventListener(state, handleResolution);
      };

      const handleResolution = () => {
        resolve();
        handleClearTimeout();
      };

      this.ws?.addEventListener(state, handleResolution, { once: true });
      const countdown = time(timeout);

      const handleRejection = () => {
        handleClearTimeout();
        const message = `WebSocket did not reach state "${state}" within ${countdown}ms.`;
        reject(new Error(message));
      };

      timerId = setTimeout(handleRejection, countdown);
    });
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

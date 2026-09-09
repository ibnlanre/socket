import { SocketCache } from "@/class/socket-cache";
import { SocketOutbox } from "@/class/socket-outbox";
import {
  SocketCloseCode,
  type SocketCode,
} from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { arrayBufferToBlob } from "@/functions/array-buffer-to-blob";
import { blobToJson } from "@/functions/blob-to-json";
import { extractOrigin } from "@/functions/extract-origin";
import { extractPathname } from "@/functions/extract-pathname";
import { getUri } from "@/functions/get-uri";
import { shallowClone } from "@/functions/shallow-clone";
import { time } from "@/functions/time";
import { toError } from "@/functions/to-error";
import {
  AsyncSchemaError,
  schemaValue,
  validateSchema,
} from "@/functions/validate-schema";

import type {
  SocketDiagnostic,
  SocketDiagnosticDetails,
} from "@/types/socket/diagnostic";
import type { SocketPrepareConnection } from "@/types/socket/prepare-connection";
import type { ConnectionParams } from "@/types/connection-params";
import type { SocketCipher } from "@/types/socket/cipher";
import type { SocketSubscriber } from "@/types/socket/client-subscriber";
import type { SocketCommands } from "@/types/socket/commands";
import type { SocketConnectionEvent } from "@/types/socket/connection-event";
import type { SocketConstructor } from "@/types/socket/constructor";
import type { SocketData } from "@/types/socket/data";
import type {
  SocketMessageFailureAction,
  SocketMessageFailurePolicy,
} from "@/types/socket/data-handling-options";
import type { SocketFetchStatus } from "@/types/socket/fetch-status";
import type { SocketListener } from "@/types/socket/listener";
import type { SocketState } from "@/types/socket/state";
import type { SocketStatus } from "@/types/socket/status";
import type { SocketTimeout } from "@/types/socket/timeout";
import type { UnitValue } from "@/types/time-unit";

type SocketMessageFailureStage = keyof Required<SocketMessageFailurePolicy>;
type SocketMessageFailure = Error & {
  closeCode: SocketCloseCode;
  stage: SocketMessageFailureStage;
};

export class Socket<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
>
  implements SocketState<Get>, SocketCommands<Post>
{
  /** A JSON WebSocket client. Incoming frames are decoded and JSON-parsed. */
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
  #eventListeners: Map<string, Set<EventListener>> = new Map();
  #focusListener: (() => void) | null = null;
  #pageHideListener: (() => void) | null = null;
  #pageShowListener: ((event: PageTransitionEvent) => void) | null = null;
  #href: string;
  #idleConnectionTimeout: number;
  #idleConnectionTimerId: SocketTimeout = undefined;
  #isOpen: boolean = false;
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
  #reconnectOnPageRestore: boolean;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #retryOnSpecificCloseCodes: SocketCode[];
  #subscribers: Set<SocketSubscriber<Get, Post, Params>> = new Set();
  #reconnectionTimerId: SocketTimeout = undefined;
  #messageSchema?: SocketConstructor<Get, Post, Params>["messageSchema"];
  #messageFailurePolicy: Required<SocketMessageFailurePolicy>;
  #preserveTerminalMetadata: boolean = false;
  #outbox: SocketOutbox;
  #generation: number = 0;
  #messages: Promise<void> = Promise.resolve();
  #controller: AbortController | null = null;
  #disposed: boolean = false;
  #waiters = new Set<() => void>();
  #snapshot: Socket<Get, Post, Params> | undefined;
  #prepareConnection?: SocketPrepareConnection;
  #onDiagnostic?: (event: SocketDiagnostic) => void;
  #maxBufferedAmount: number;
  #maxPendingMessages: number;
  #unsubscribeCache?: () => void;
  #sendSchema?: SocketConstructor<Get, Post, Params>["sendSchema"];

  constructor(
    {
      prepareConnection,
      onDiagnostic,
      maxQueueSize,
      queueMaxAge,
      queueOverflow,
      maxBufferedAmount = 1048576,
      maxPendingMessages = 1000,
      maxDeduplicationEntries,
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
      placeholderData,
      sendSchema,
      protocols = [],
      reconnectOnNetworkRestore = true,
      reconnectOnWindowFocus = true,
      reconnectOnPageRestore = true,
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
    }: SocketConstructor<Get, Post, Params, unknown>,
    params = {} as Params
  ) {
    this.#prepareConnection = prepareConnection;
    this.#onDiagnostic = onDiagnostic;
    this.#maxBufferedAmount = maxBufferedAmount;
    this.#maxPendingMessages = maxPendingMessages;
    if (!Number.isInteger(maxPendingMessages) || maxPendingMessages < 1)
      throw new RangeError("maxPendingMessages must be a positive integer.");
    if (!Number.isFinite(maxBufferedAmount) || maxBufferedAmount < 0)
      throw new RangeError("maxBufferedAmount must be nonnegative.");
    this.#outbox = new SocketOutbox(
      {
        maxQueueSize,
        queueMaxAge,
        queueOverflow,
        maxDeduplicationEntries,
        deduplicationWindow: time(deduplicationWindow),
      },
      this.#dispatchPayload,
      this.#diagnostic
    );
    this.binaryType = binaryType;
    this.#clearCacheOnClose = clearCacheOnClose;
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
    this.#reconnectOnPageRestore = reconnectOnPageRestore;
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
      ...(preserveError
        ? {}
        : { status: this.value === undefined ? "idle" : "stale" }),
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

    this.#eventListeners.forEach((listeners, event) => {
      listeners.forEach((listener) => {
        this.ws?.removeEventListener(event, listener);
      });
    });
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

  #cleanupPageLifecycleListeners = () => {
    if (this.#pageHideListener) {
      window.removeEventListener("pagehide", this.#pageHideListener);
      this.#pageHideListener = null;
    }

    if (this.#pageShowListener) {
      window.removeEventListener("pageshow", this.#pageShowListener);
      this.#pageShowListener = null;
    }
  };

  #connect = async () => {
    if (!this.#isOpen || this.ws || this.#controller) return;
    const generation = ++this.#generation;
    const controller = new AbortController();
    this.#controller = controller;
    const current = () => generation === this.#generation && this.#isOpen;
    this.#setState({ fetchStatus: "connecting" });
    try {
      this.#diagnostic({ type: "connection", phase: "preparing" });
      const prepared = await this.#prepareConnection?.({
        url: this.#href,
        protocols: this.#protocols,
        signal: controller.signal,
        attempt: this.failureCount,
      });
      if (!current()) return;
      this.ws = new WebSocket(
        prepared?.url ?? this.#href,
        prepared?.protocols ?? this.#protocols
      );
    } catch (error) {
      if (!current()) return;
      this.#controller = null;
      this.#setState({
        status: "error",
        fetchStatus: "disconnected",
        error: toError(error),
        errorUpdatedAt: Date.now(),
        failureCount: this.failureCount + 1,
      });
      if (this.#retry && this.failureCount <= this.#retryCount)
        this.#reconnect();
      else this.#isOpen = false;
      return;
    }
    this.#messages = Promise.resolve();
    this.#diagnostic({ type: "connection", phase: "connecting" });
    this.ws.binaryType = this.binaryType;
    this.#eventListeners.forEach((listeners, event) => {
      listeners.forEach((listener) => {
        this.ws?.addEventListener(event, listener);
      });
    });
    this.#setState({
      fetchStatus: "connecting",
      status: this.value === undefined ? "loading" : "stale",
    });

    this.ws.onopen = (ev: Event) => {
      if (!current()) return;
      this.#outbox.flush();
      this.#diagnostic({ type: "connection", phase: "open" });

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

    let pendingMessages = 0;
    this.ws.onmessage = (ev: MessageEvent) => {
      if (!current()) return;
      if (pendingMessages >= this.#maxPendingMessages) {
        this.close();
        this.#setState({
          status: "error",
          error: new RangeError("Socket: incoming message queue is full."),
          errorUpdatedAt: Date.now(),
        });
        return;
      }
      pendingMessages += 1;
      this.#messages = this.#messages
        .then(async () => {
          if (!current()) return;
          try {
            await this.#saveData(ev, current);
            if (!current()) return;

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
            if (!current()) return;
            if (this.#shouldLog("error")) {
              const target = ev.target as WebSocket;

              console.error("WebSocket connection error", {
                data: ev.data,
                url: target.url,
                error: err,
              });
            }

            const error = toError(err);
            if (this.#isMessageFailure(error) && error.stage === "validation")
              this.#diagnostic({
                type: "validation",
                direction: "incoming",
                error,
              });

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
        })
        .catch(() => {})
        .finally(() => {
          pendingMessages -= 1;
        });
    };

    this.ws.onclose = (event: CloseEvent) => {
      if (!current()) return;
      this.#generation += 1;
      this.#controller?.abort();
      this.#controller = null;
      this.ws = null;
      this.#diagnostic({ type: "connection", phase: "closed" });
      clearTimeout(this.#reconnectionTimerId);

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
        this.#setState({ fetchStatus: "disconnected" });
        this.#reconnect();
        return;
      }

      this.#cleanup({
        preserveError: this.#preserveTerminalMetadata,
        preserveFailure: this.#preserveTerminalMetadata,
      });
    };

    this.ws.onerror = (event: Event) => {
      if (!current()) return;
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
    Object.freeze(state);
    this.#snapshot = state;
    this.#subscribers.forEach((listener) => listener(state));
  };

  #reconnect = () => {
    const backoffDelay = this.#calculateBackoff();
    this.#diagnostic({
      type: "retry",
      attempt: this.failureCount,
      delay: backoffDelay,
    });
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

  #saveData = async ({ data }: SocketData, current: () => boolean) => {
    const decoded = await this.#decodeMessageData(data);
    const payload = await this.#parseMessage(decoded);

    if (!current()) return;
    await this.cache.set(this.path, payload);
  };

  #parseMessage = async (payload: string): Promise<string> => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw this.#createMessageFailure(error, "parse");
    }

    if (!this.#messageSchema) return JSON.stringify(parsed);

    let result;
    try {
      result = await this.#messageSchema["~standard"].validate(parsed);
    } catch (error) {
      throw this.#createMessageFailure(error, "validation");
    }
    if (result.issues) {
      throw this.#createMessageFailure(
        new Error(
          `Socket: message schema validation failed: ${this.#formatSchemaIssues(result.issues)}`,
          { cause: result.issues }
        ),
        "validation"
      );
    }
    return JSON.stringify(result.value);
  };

  #formatSchemaIssues = (issues: ReadonlyArray<{ message: string }>) => {
    return issues.map(({ message }) => message).join("; ");
  };

  #createMessageFailure = (
    error: unknown,
    stage: SocketMessageFailureStage
  ): SocketMessageFailure => {
    const failure = toError(error);

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

  #diagnostic = (event: SocketDiagnosticDetails) => {
    try {
      this.#onDiagnostic?.({
        ...event,
        timestamp: Date.now(),
      } as SocketDiagnostic);
    } catch {
      /* Diagnostics must not alter transport behavior. */
    }
  };

  #dispatchPayload = (payload: unknown): boolean => {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    if (this.ws.bufferedAmount > this.#maxBufferedAmount) return false;
    if (this.#encryptPayload && this.#encrypt) payload = this.#encrypt(payload);
    this.ws.send(JSON.stringify(payload));
    return true;
  };

  #setState = (newState: Partial<Socket<Get, Post, Params>>) => {
    for (const key in newState) this[key] = newState[key];
    this.#notifySubscribers();
  };

  #setupNetworkListener = () => {
    if (!this.#reconnectOnNetworkRestore || typeof window === "undefined")
      return;

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
    if (!this.#reconnectOnWindowFocus || typeof window === "undefined") return;

    this.#focusListener = () => {
      if (this.isIdle) this.#connect();
    };

    window.addEventListener("focus", this.#focusListener, true);
  };

  #setupPageLifecycleListeners = () => {
    if (!this.#reconnectOnPageRestore || typeof window === "undefined") return;

    this.#pageHideListener = () => {
      const code = SocketCloseCode.NORMAL_CLOSURE;
      const reason = SocketCloseReason[code];
      this.#cleanupEventListeners();

      if (this.ws?.readyState !== WebSocket.CLOSED) {
        this.ws?.close(code, reason);
      }

      this.#generation += 1;
      this.#controller?.abort();
      this.#controller = null;
      this.ws = null;
      this.#isOpen = false;
      this.#cleanup();
    };

    this.#pageShowListener = (event: PageTransitionEvent) => {
      if (event.persisted && this.isIdle) {
        this.#isOpen = true;
        this.#connect();
      }
    };

    window.addEventListener("pagehide", this.#pageHideListener);
    window.addEventListener("pageshow", this.#pageShowListener);
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

    if (!event.wasClean && this.#retry) {
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

    this.#generation += 1;
    this.#controller?.abort();
    this.#controller = null;
    this.#messages = Promise.resolve();
    this.#outbox.clear();
    clearTimeout(this.#idleConnectionTimerId);
    this.#unsubscribeCache?.();
    this.#unsubscribeCache = undefined;
    this.#isOpen = false;
    if (this.ws?.readyState !== WebSocket.CLOSED) this.ws?.close(code, reason);
    if (this.#clearCacheOnClose) this.cache.remove(this.path);

    this.#cleanup();
    this.#waiters.forEach((cancel) => cancel());
    this.#cleanupNetworkListener();
    this.#cleanupWindowFocusListener();
    this.#cleanupPageLifecycleListeners();

    this.ws = null;
  };

  /**
   * Subscribe to a native WebSocket event. Returns an unsubscribe function.
   *
   * The store is keyed by the handler that was passed: each distinct handler
   * owns its own subscription, while registering the same handler again is a
   * no-op that returns the shared unsubscribe. Consumers that share one pooled
   * socket should pass their own handler so one unmount never detaches
   * another's subscription.
   */
  on: SocketListener = (event, callback) => {
    this.#assertActive();
    let listeners = this.#eventListeners.get(event);
    listeners ??= new Set();

    const listener = callback as EventListener;
    const isAbsent = !listeners.has(listener);

    listeners.add(listener);
    this.#eventListeners.set(event, listeners);

    // Native addEventListener is idempotent per (event, handler): only attach
    // for a handler that is not subscribed yet.
    if (isAbsent) this.ws?.addEventListener(event, listener);

    return () => {
      if (!listeners.has(listener)) return;
      listeners.delete(listener);
      this.ws?.removeEventListener(event, listener);
      if (listeners.size === 0) this.#eventListeners.delete(event);
    };
  };

  open = () => {
    this.#assertActive();
    if (this.ws || this.#isOpen) return;

    this.#isOpen = true;
    this.#cleanup();
    const generation = this.#generation;
    this.#unsubscribeCache = this.cache.subscribe(this.#setValue);

    this.#setupNetworkListener();
    this.#setupWindowFocusListener();
    this.#setupPageLifecycleListeners();

    const current = () => generation === this.#generation && this.#isOpen;
    void this.cache.initialize(this.path, current).then(
      () => {
        if (!current()) return;
        if (this.cache.value !== undefined)
          this.#diagnostic({ type: "cache", action: "hit" });
        return this.#connect();
      },
      (error) => {
        if (!current()) return;
        this.#diagnostic({
          type: "cache",
          action: "error",
          error: toError(error),
        });
        return this.#connect();
      }
    );
  };

  #assertActive = () => {
    if (this.#disposed)
      throw new Error("Socket: this instance has been disposed.");
  };

  /** Release the instance permanently. Use close() for a reversible disconnect. */
  dispose = () => {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.#eventListeners.clear();
    this.#subscribers.clear();
  };

  getSnapshot = (): Socket<Get, Post, Params> => {
    if (!this.#snapshot) {
      this.#snapshot = shallowClone(this);
      Object.freeze(this.#snapshot);
    }
    return this.#snapshot;
  };

  send = (payload: Post): boolean => {
    this.#assertActive();
    let value: unknown = payload;
    try {
      if (this.#sendSchema)
        value = validateSchema(
          this.#sendSchema,
          payload,
          "Socket: send schema validation failed"
        );
    } catch (error) {
      if (error instanceof AsyncSchemaError) throw error;
      const failure = this.#createMessageFailure(error, "validation");
      this.#diagnostic({
        type: "validation",
        direction: "outgoing",
        error: failure,
      });
      throw failure;
    }
    return this.#outbox.send(value);
  };

  sendAsync = (
    payload: Post,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<boolean> => {
    this.#assertActive();
    return this.#outbox.sendAsync(async () => {
      try {
        if (!this.#sendSchema) return payload;
        const result = await this.#sendSchema["~standard"].validate(payload);
        return schemaValue(result, "Socket: send schema validation failed");
      } catch (error) {
        const failure = this.#createMessageFailure(error, "validation");
        this.#diagnostic({
          type: "validation",
          direction: "outgoing",
          error: failure,
        });
        throw failure;
      }
    }, signal);
  };

  subscribe = (
    listener: (client: Socket<Get, Post, Params>) => void,
    immediate = true
  ) => {
    this.#assertActive();
    clearTimeout(this.#idleConnectionTimerId);

    if (!this.#subscribers.has(listener)) {
      if (immediate) listener(this.getSnapshot());
      this.#subscribers.add(listener);
    }

    return () => {
      this.#subscribers.delete(listener);

      if (!this.#disposed && this.#subscribers.size === 0) {
        this.#idleConnectionTimerId = setTimeout(
          this.close,
          this.#idleConnectionTimeout
        );
      }
    };
  };

  waitUntil = (
    state: SocketConnectionEvent,
    timeout: UnitValue = "5 seconds",
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<void> => {
    this.#assertActive();
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
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      if (hasReachedState()) {
        resolve();
        return;
      }

      const cleanup = () => {
        clearTimeout(timerId);
        this.#subscribers.delete(listener);
        this.#waiters.delete(cancel);
        signal?.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        cleanup();
        reject(
          signal?.reason ?? new DOMException("Socket closed", "AbortError")
        );
      };

      const listener = () => {
        if (hasReachedState()) {
          cleanup();
          resolve();
        }
      };

      this.#subscribers.add(listener);
      this.#waiters.add(cancel);
      signal?.addEventListener("abort", cancel, { once: true });
      const countdown = time(timeout);

      timerId = setTimeout(() => {
        cleanup();
        const message = `WebSocket did not reach state "${state}" within ${countdown}ms.`;
        reject(new Error(message));
      }, countdown);
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

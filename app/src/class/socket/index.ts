import type { SocketGate } from "@/class/socket-gate";
import type { SocketCode } from "@/constants/socket-close-code";
import type { ConnectionParams } from "@/types/connection-params";
import type { RuntimeAdapters, WebSocketConstructor } from "@/types/runtime";
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
import type {
  SocketDiagnostic,
  SocketDiagnosticDetails,
} from "@/types/socket/diagnostic";
import type { SocketFetchStatus } from "@/types/socket/fetch-status";
import type { SocketListener } from "@/types/socket/listener";
import type { SocketPrepareConnection } from "@/types/socket/prepare-connection";
import type { SocketState } from "@/types/socket/state";
import type { SocketStatus } from "@/types/socket/status";
import type { SocketTimeout } from "@/types/socket/timeout";
import type { UnitValue } from "@/types/time-unit";

import { SocketCache } from "@/class/socket-cache";
import { SocketOutbox } from "@/class/socket-outbox";
import { QuietCloseCodes } from "@/constants/quiet-close-codes";
import { SocketCloseCode } from "@/constants/socket-close-code";
import { SocketCloseReason } from "@/constants/socket-close-reason";
import { SocketReadyState } from "@/constants/socket-ready-state";
import { arrayBufferToBlob } from "@/functions/array-buffer-to-blob";
import { blobToJson } from "@/functions/blob-to-json";
import { extractOrigin } from "@/functions/extract-origin";
import { extractPathname } from "@/functions/extract-pathname";
import { getUri } from "@/functions/get-uri";
import { shallowClone } from "@/functions/shallow-clone";
import { time } from "@/functions/time";
import { toError } from "@/functions/to-error";
import { schemaValue } from "@/functions/validate-schema";

type SocketMessageFailure = Error & {
  closeCode: SocketCloseCode;
  stage: SocketMessageFailureStage;
};
type SocketMessageFailureStage = keyof Required<SocketMessageFailurePolicy>;

const snapshots = new WeakMap<object, object>();

export class Socket<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
>
  implements SocketCommands<Post>, SocketState<Get>
{
  /** A JSON WebSocket client. Incoming frames are decoded and JSON-parsed. */
  binaryType: "arraybuffer" | "blob" = "blob";
  cache: SocketCache<Get>;
  dataUpdatedAt: number = 0;
  error: Error | null = null;
  errorTimeout: number = 0;
  errorUpdatedAt: number = 0;
  failureCount: number = 0;
  failureReason: null | string = null;
  fetchStatus: SocketFetchStatus = "idle";
  /**
   * Whether the socket has stopped after a failure it will not retry: its
   * retries used up, or its close code not one it retries. With retrying
   * off, a failed close ends quietly instead, and only a connection that
   * could not be prepared stops. It stays closed until
   * `open()` starts it again, which is how a caller offers "reconnect".
   * Closing it on purpose, or its last subscriber leaving, clears it: nothing
   * waits on it then.
   */
  isExhausted: boolean = false;
  isPlaceholderData: boolean = false;
  path: string = "";
  status: SocketStatus = "loading";
  value: Get | undefined = undefined;
  ws: null | WebSocket = null;

  get isConnected(): boolean {
    return this.fetchStatus === "connected";
  }
  get isConnecting(): boolean {
    return this.fetchStatus === "connecting";
  }
  get isDisconnected(): boolean {
    return this.fetchStatus === "disconnected";
  }
  get isError(): boolean {
    return this.status === "error";
  }
  get isIdle(): boolean {
    return this.fetchStatus === "idle";
  }
  get isLoading(): boolean {
    return this.status === "loading";
  }
  get isPending(): boolean {
    if (this.isPlaceholderData) return true;
    return this.value === undefined;
  }
  get isPreparing(): boolean {
    return this.fetchStatus === "preparing";
  }
  get isRefetchError(): boolean {
    return this.isError && this.failureCount > 0;
  }
  get isRefetching(): boolean {
    return this.isLoading && this.failureCount > 0;
  }
  get isStaleData(): boolean {
    return this.status === "stale";
  }
  get isSuccess(): boolean {
    return this.status === "success";
  }
  #clearCacheOnClose: boolean;
  #controller: AbortController | null = null;
  #disposed: boolean = false;
  #encrypt?: SocketCipher;
  #encryptPayload: boolean;
  #eventListeners: Map<string, Set<EventListener>> = new Map();
  #failureResetTimerId: SocketTimeout = undefined;
  #focusListener: (() => void) | null = null;
  #gate?: SocketGate;
  #generation: number = 0;
  #href: string;
  #idleConnectionTimeout: number;
  #idleConnectionTimerId: SocketTimeout = undefined;
  #isOpen: boolean = false;
  #log: SocketConnectionEvent[];
  #logCondition: (logType: SocketConnectionEvent) => boolean;
  #maxBufferedAmount: number;
  #maxJitterValue: number;
  #maxPendingMessages: number;
  #maxRetryDelay: number;
  #messageFailurePolicy: Required<SocketMessageFailurePolicy>;
  #messages: Promise<void> = Promise.resolve();
  #messageSchema?: SocketConstructor<Get, Post, Params>["messageSchema"];
  #minJitterValue: number;
  #networkRestoreListener: (() => void) | null = null;
  /** Watchers of its state that, unlike subscribers, do not keep it open. */
  #observers: Set<() => void> = new Set();
  #onDiagnostic?: (event: SocketDiagnostic) => void;
  #outbox: SocketOutbox;
  #pageHideListener: (() => void) | null = null;
  #pageShowListener: ((event: PageTransitionEvent) => void) | null = null;
  #prepareConnection?: SocketPrepareConnection;
  #preserveTerminalMetadata: boolean = false;
  #protocols: string | string[];
  #reconnectionTimerId: SocketTimeout = undefined;
  #reconnectOnNetworkRestore: boolean;
  #reconnectOnPageRestore: boolean;
  #reconnectOnWindowFocus: boolean;
  #retry: boolean;
  #retryBackoffStrategy: "exponential" | "fixed";
  #retryCount: number;
  #retryDelay: number;
  #retryOnCustomCondition?: (event: CloseEvent, target: WebSocket) => boolean;
  #retryOnSpecificCloseCodes: SocketCode[];
  #runtime?: RuntimeAdapters;
  #sendSchema?: SocketConstructor<Get, Post, Params>["sendSchema"];
  #subscribers: Set<SocketSubscriber<Get, Post, Params>> = new Set();
  #unsubscribeCache?: () => void;
  #waiters = new Set<() => void>();
  constructor(
    {
      baseURL = "",
      binaryType = "blob",
      cacheFallback = "none",
      cacheKey,
      clearCacheOnClose = false,
      decrypt,
      decryptData = true,
      deduplicationWindow = 0,
      disableCache = false,
      encrypt,
      encryptPayload = true,
      gate,
      idleConnectionTimeout = "5 minutes",
      log = ["open", "close", "error"],
      logCondition = () => process.env.NODE_ENV === "development",
      maxBufferedAmount = 1048576,
      maxCacheAge = "15 minutes",
      maxDeduplicationEntries,
      maxJitterValue = 1.2,
      maxPendingMessages = 1000,
      maxQueueSize,
      maxRetryDelay = "1 minute",
      messageFailurePolicy,
      messageSchema,
      minJitterValue = 0.8,
      onDiagnostic,
      placeholderData,
      prepareConnection,
      protocols = [],
      queueMaxAge,
      queueOverflow,
      reconnectOnNetworkRestore = true,
      reconnectOnPageRestore = true,
      reconnectOnWindowFocus = true,
      retry = false,
      retryBackoffStrategy = "exponential",
      retryCount = 3,
      retryDelay = "5 seconds",
      retryOnCustomCondition,
      retryOnSpecificCloseCodes = [
        SocketCloseCode.ABNORMAL_CLOSURE,
        SocketCloseCode.TRY_AGAIN_LATER,
        SocketCloseCode.SERVICE_RESTART,
      ],
      runtime,
      sendSchema,
      setStateAction,
      url,
    }: SocketConstructor<Get, Post, Params, unknown>,
    params = {} as Params
  ) {
    this.#prepareConnection = prepareConnection;
    this.#gate = gate;
    this.#runtime = runtime;
    this.#onDiagnostic = onDiagnostic;
    this.#maxBufferedAmount = maxBufferedAmount;
    this.#maxPendingMessages = maxPendingMessages;

    if (!Number.isInteger(maxPendingMessages) || maxPendingMessages < 1) {
      throw new RangeError("maxPendingMessages must be a positive integer.");
    }

    if (!Number.isFinite(maxBufferedAmount) || maxBufferedAmount < 0) {
      throw new RangeError("maxBufferedAmount must be nonnegative.");
    }

    this.#outbox = new SocketOutbox(
      {
        deduplicationWindow: time(deduplicationWindow),
        maxDeduplicationEntries,
        maxQueueSize,
        queueMaxAge,
        queueOverflow,
      },
      this.#dispatchPayload,
      this.#diagnostic
    );
    this.binaryType = binaryType;
    this.#clearCacheOnClose = clearCacheOnClose;
    this.#encrypt = encrypt;
    this.#encryptPayload = encryptPayload;
    this.#href = getUri({ baseURL, params, url });
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
      fallback: cacheFallback,
      maxCacheAge: time(maxCacheAge),
      origin,
      runtime: this.#runtime,
      setStateAction,
    });

    if (placeholderData !== undefined) {
      this.#setState({ isPlaceholderData: true, value: placeholderData });
    }
  }

  close = () => {
    const code = SocketCloseCode.NORMAL_CLOSURE;
    const reason = SocketCloseReason[code];

    // Closed on purpose: no longer waiting to be reopened.
    if (this.isExhausted) this.#setState({ isExhausted: false });
    // A handshake given up hands its turn on now: a transport closed while
    // still connecting may never report the close.
    this.#endTurn();

    this.#generation += 1;
    this.#controller?.abort();
    this.#controller = null;
    this.#messages = Promise.resolve();
    this.#outbox.clear();

    clearTimeout(this.#idleConnectionTimerId);
    this.#unsubscribeCache?.();
    this.#unsubscribeCache = undefined;
    this.#isOpen = false;

    if (this.ws?.readyState !== SocketReadyState.CLOSED) {
      this.ws?.close(code, reason);
    }
    if (this.#clearCacheOnClose) this.cache.remove(this.path);

    this.#cleanup();
    this.#waiters.forEach((cancel) => cancel());
    this.#cleanupNetworkListener();
    this.#cleanupWindowFocusListener();
    this.#cleanupPageLifecycleListeners();

    this.ws = null;
  };

  /** Release the instance permanently. Use close() for a reversible disconnect. */
  dispose = () => {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
    this.#eventListeners.clear();
    this.#subscribers.clear();
    this.#observers.clear();
    snapshots.delete(this);
  };

  /** Whether anything subscribes to the socket, so is reading it now. */
  hasSubscribers = (): boolean => this.#subscribers.size > 0;

  /**
   * Watch the socket's state, and its subscribers coming and going, without
   * subscribing: an observer neither keeps the connection open nor stops it
   * closing when idle. For tooling that watches many sockets, such as a
   * client noticing which have stopped. Returns a function that stops watching.
   */
  observe = (listener: () => void) => {
    this.#assertActive();
    this.#observers.add(listener);
    return () => {
      this.#observers.delete(listener);
    };
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
    // Preparing from here: the stored copy is read before the connection begins.
    this.#setState({ fetchStatus: "preparing" });

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
          this.#diagnostic({ action: "hit", type: "cache" });
        return this.#connect();
      },
      (error) => {
        if (!current()) return;
        this.#diagnostic({
          action: "error",
          error: toError(error),
          type: "cache",
        });
        return this.#connect();
      }
    );
  };

  /**
   * Hold `value` until the socket has its own, as `useSocket`'s `initialData`
   * does. Ignored once it holds a value other than `placeholderData`.
   */
  seed = (value: Get) => {
    this.#assertActive();
    if (this.value !== undefined && !this.isPlaceholderData) return;
    if (this.cache.seed(value)) this.#setValue(value);
  };

  send = async (
    payload: Post,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<boolean> => {
    this.#assertActive();
    return this.#outbox.send(async () => {
      try {
        if (!this.#sendSchema) return payload;
        const result = await this.#sendSchema["~standard"].validate(payload);
        return schemaValue(result, "Socket: send schema validation failed");
      } catch (error) {
        const failure = this.#createMessageFailure(error, "validation");
        this.#diagnostic({
          direction: "outgoing",
          error: failure,
          type: "validation",
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
      if (immediate) listener(readSocketSnapshot(this));
      this.#subscribers.add(listener);
      this.#notifyObservers();
    }

    return () => {
      if (this.#subscribers.delete(listener)) {
        // Stopped and now read by nothing: no longer waiting to be reopened.
        if (this.isExhausted && this.#subscribers.size === 0) {
          this.#setState({ isExhausted: false });
        } else this.#notifyObservers();
      }

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

  #assertActive = () => {
    if (this.#disposed)
      throw new Error("Socket: this instance has been disposed.");
  };

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
    clearTimeout(this.#failureResetTimerId);

    this.#cleanupEventListeners();
    this.#preserveTerminalMetadata = false;
    this.#setState({
      fetchStatus: "idle",
      isExhausted: false,
      ...(preserveError
        ? {}
        : { status: this.value === undefined ? "idle" : "stale" }),
      ...(preserveFailure
        ? {}
        : {
            failureCount: 0,
            failureReason: null,
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

  #cleanupWindowFocusListener = () => {
    if (this.#focusListener) {
      window.removeEventListener("focus", this.#focusListener);
      this.#focusListener = null;
    }
  };

  #connect = async () => {
    if (!this.#isOpen || this.ws || this.#controller) return;

    const generation = ++this.#generation;
    const controller = new AbortController();
    this.#controller = controller;

    const current = () => generation === this.#generation && this.#isOpen;
    this.#setState({ fetchStatus: "preparing" });

    // This attempt's turn at the gate, if it has one: ended once the
    // handshake opens or closes, or the socket is closed, whatever has become
    // of the socket. Not on an error: one comes before its close, and the
    // next handshake would begin while this one is still ending.
    let endTurn = () => {};
    try {
      this.#diagnostic({ phase: "preparing", type: "connection" });
      const prepared = await this.#prepareConnection?.({
        attempt: this.failureCount,
        protocols: this.#protocols,
        signal: controller.signal,
        url: this.#href,
      });

      if (!current()) return;
      const href = prepared?.url ?? this.#href;

      if (this.#gate) {
        // Wait for a turn to connect to this server; still "preparing" meanwhile.
        endTurn = await this.#gate.acquire(href, {
          signal: controller.signal,
        });

        if (!current()) return endTurn();
        this.#endTurn = endTurn;
      }

      this.ws = new (this.#webSocketConstructor())(
        href,
        prepared?.protocols ?? this.#protocols
      );
    } catch (error) {
      endTurn();
      if (!current()) return;

      this.#controller = null;
      this.#setState({
        error: toError(error),
        errorUpdatedAt: Date.now(),
        failureCount: this.failureCount + 1,
        fetchStatus: "disconnected",
        status: "error",
      });

      if (this.#retry && this.failureCount <= this.#retryCount) {
        this.#reconnect();
      } else this.#stop();
      return;
    }

    this.#messages = Promise.resolve();
    this.#diagnostic({ phase: "connecting", type: "connection" });
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
      endTurn();
      if (!current()) return;
      this.#outbox.flush();
      this.#diagnostic({ phase: "open", type: "connection" });

      this.#setState({
        binaryType: this.binaryType,
        error: null,
        errorUpdatedAt: 0,
        failureReason: null,
        fetchStatus: "connected",
      });

      // Opening alone does not show the server will keep the connection.
      this.#failureResetTimerId = setTimeout(
        this.#resetFailures,
        this.#maxRetryDelay
      );

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
          error: new RangeError("Socket: incoming message queue is full."),
          errorUpdatedAt: Date.now(),
          status: "error",
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

            this.#resetFailures();
            this.#setState({
              dataUpdatedAt: Date.now(),
              error: null,
              errorUpdatedAt: 0,
              status: "success",
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
                error: err,
                url: target.url,
              });
            }

            const error = toError(err);
            if (this.#isMessageFailure(error) && error.stage === "validation")
              this.#diagnostic({
                direction: "incoming",
                error,
                type: "validation",
              });

            this.#setState({
              error,
              errorUpdatedAt: Date.now(),
              status: "error",
            });

            if (this.#getMessageFailureAction(error) === "close") {
              const closeCode = this.#getMessageFailureCode(error);

              this.#preserveTerminalMetadata = true;
              this.#setState({
                failureCount: this.failureCount + 1,
                failureReason: SocketCloseReason[closeCode] ?? error.message,
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
      endTurn();
      if (!current()) return;

      this.#generation += 1;
      this.#controller?.abort();
      this.#controller = null;
      this.ws = null;
      this.#diagnostic({ phase: "closed", type: "connection" });

      clearTimeout(this.#reconnectionTimerId);
      clearTimeout(this.#failureResetTimerId);

      if (this.#clearCacheOnClose) {
        this.cache.remove(this.path);
      }

      if (!this.#isFailure(event)) {
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

      // A failure it will not retry: the socket stops, its error and failure
      // count kept, until it is opened again.
      const failed = this.#preserveTerminalMetadata;
      this.#cleanup({ preserveError: failed, preserveFailure: failed });
      if (failed) this.#stop();
    };

    this.ws.onerror = (event: Event) => {
      if (!current()) return;
      this.#setState({
        error: new Error("WebSocket connection error"),
        errorTimeout: event.timeStamp,
        errorUpdatedAt: Date.now(),
        status: "error",
      });
    };
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
    if (this.ws?.readyState !== SocketReadyState.OPEN) return false;
    if (this.ws.bufferedAmount > this.#maxBufferedAmount) return false;
    if (this.#encryptPayload && this.#encrypt) payload = this.#encrypt(payload);
    this.ws.send(JSON.stringify(payload));
    return true;
  };

  /** Ends the current attempt's turn at the gate; a no-op between attempts. */
  #endTurn = () => {};

  #getMessageFailureAction = (error: Error): SocketMessageFailureAction => {
    if (!this.#isMessageFailure(error)) return "recover";
    return this.#messageFailurePolicy[error.stage];
  };

  #getMessageFailureCode = (error: Error): SocketCloseCode => {
    if (this.#isMessageFailure(error)) return error.closeCode;
    return SocketCloseCode.INVALID_PAYLOAD_DATA;
  };

  /**
   * Whether a close is a failure: one without a close frame, or a clean one
   * whose code reports a fault (1011 for an error on the server, 1013 to try
   * again later, an application's own code). A normal close, a going away and
   * a close without a status end the connection quietly.
   */
  #isFailure = (event: CloseEvent): boolean => {
    if (!event.wasClean) return true;
    return !QuietCloseCodes.includes(event.code);
  };

  #isMessageFailure = (error: Error): error is SocketMessageFailure => {
    return "closeCode" in error && "stage" in error;
  };

  #notifyObservers = () => {
    this.#observers.forEach((listener) => listener());
  };

  #notifySubscribers = () => {
    const state = storeSocketSnapshot(this);
    this.#subscribers.forEach((listener) => listener(state));
    this.#notifyObservers();
  };

  #parseMessage = async (payload: string): Promise<string> => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw this.#createMessageFailure(error, "parse");
    }

    if (!this.#messageSchema) return JSON.stringify(parsed);

    let value: unknown;
    try {
      const result = await this.#messageSchema["~standard"].validate(parsed);
      value = schemaValue(result, "Socket: message schema validation failed");
    } catch (error) {
      throw this.#createMessageFailure(error, "validation");
    }
    return JSON.stringify(value);
  };

  #reconnect = () => {
    const backoffDelay = this.#calculateBackoff();
    this.#diagnostic({
      attempt: this.failureCount,
      delay: backoffDelay,
      type: "retry",
    });
    this.#reconnectionTimerId = setTimeout(this.#connect, backoffDelay);
  };

  /** Called once a connection has delivered a message or stayed open. */
  #resetFailures = () => {
    clearTimeout(this.#failureResetTimerId);
    if (this.failureCount > 0) this.#setState({ failureCount: 0 });
  };

  #saveData = async ({ data }: SocketData, current: () => boolean) => {
    const decoded = await this.#decodeMessageData(data);
    const payload = await this.#parseMessage(decoded);

    if (!current()) return;
    await this.cache.set(this.path, payload);
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

  #setupPageLifecycleListeners = () => {
    if (!this.#reconnectOnPageRestore || typeof window === "undefined") return;

    this.#pageHideListener = () => {
      const code = SocketCloseCode.NORMAL_CLOSURE;
      const reason = SocketCloseReason[code];
      this.#cleanupEventListeners();

      if (this.ws?.readyState !== SocketReadyState.CLOSED) {
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

  #setupWindowFocusListener = () => {
    if (!this.#reconnectOnWindowFocus || typeof window === "undefined") return;

    this.#focusListener = () => {
      if (this.isIdle) this.#connect();
    };

    // The window's own focus only: not in the capture phase, where every
    // element's focus inside the page would reach it as well.
    window.addEventListener("focus", this.#focusListener);
  };

  #setValue = (value: Get) => {
    const status = this.isConnected ? "success" : "stale";
    this.#setState({ isPlaceholderData: false, status, value });
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
        code: errorCode,
        explanation: SocketCloseReason[errorCode],
        reason: SocketCloseCode[errorCode],
        url: target.url,
      });
    }

    // Only failures reach here: a quiet close has already ended the connection.
    const retryable =
      this.#retry &&
      this.failureCount < this.#retryCount &&
      (this.#retryOnCustomCondition?.(event, target) ||
        this.#retryOnSpecificCloseCodes.includes(errorCode));

    if (retryable) {
      this.#setState({
        failureCount: this.failureCount + 1,
        failureReason: reason,
        fetchStatus: "disconnected",
        status: "idle",
      });
      return true;
    }

    // Retrying off: the connection ends quietly, as a quiet close does, and
    // the environment's reconnects (focus, network, page restore) may revive it.
    if (!this.#retry) return false;

    // A failure it will not retry, its retries used up or its code not asked
    // for: counted once, and kept until it is opened again.
    this.#preserveTerminalMetadata = true;
    this.#setState({
      error: this.error ?? new Error(reason),
      errorUpdatedAt: this.errorUpdatedAt || Date.now(),
      failureCount: this.failureCount + 1,
      failureReason: reason,
      status: "error",
    });

    return false;
  };

  /**
   * Stop after a failure it will not retry. Closed for good until `open()`:
   * otherwise `open()` would find it still marked open and do nothing.
   */
  #stop = () => {
    this.#isOpen = false;
    this.#setState({ isExhausted: true });
  };

  /**
   * The WebSocket implementation to use: injected adapter first, then the
   * ambient global. Resolved when a connection is attempted so a missing
   * implementation never breaks import or construction.
   * @private
   */
  #webSocketConstructor = (): WebSocketConstructor => {
    const implementation =
      this.#runtime?.webSocket ??
      (typeof WebSocket === "undefined" ? undefined : WebSocket);

    if (!implementation) {
      throw new Error(
        "Socket: no WebSocket implementation is available in this runtime. Pass `runtime.webSocket` to the constructor."
      );
    }

    return implementation;
  };
}

/**
 * Read the current immutable state snapshot for a `Socket`.
 *
 * @internal Not part of the public API — used by the React integration.
 */
export function readSocketSnapshot<G, P, Pr extends ConnectionParams>(
  socket: Socket<G, P, Pr>
): Socket<G, P, Pr> {
  return (
    (snapshots.get(socket) as Socket<G, P, Pr> | undefined) ??
    storeSocketSnapshot(socket)
  );
}

function storeSocketSnapshot<T extends object>(socket: T): T {
  const state = shallowClone(socket);
  Object.freeze(state);
  snapshots.set(socket, state);
  return state;
}

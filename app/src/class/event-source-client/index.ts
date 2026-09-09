import { getUri } from "@/functions/get-uri";
import { shallowMerge } from "@/functions/shallow-merge";
import { time } from "@/functions/time";
import { toError } from "@/functions/to-error";

import type { ConnectionParams } from "@/types/connection-params";
import type { EventSourceClientOptions } from "@/types/event-source/constructor";
import type { EventSourceListener } from "@/types/event-source/listener";
import type { EventSourceStatus } from "@/types/event-source/status";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export class EventSourceClient<
  Data = unknown,
  Params extends ConnectionParams = never,
> {
  error: Error | null = null;
  status: EventSourceStatus = "idle";
  #abortController: AbortController = new AbortController();
  #cache: string;
  #eventSource: EventSource | null = null;
  #lastEventId: string | null;
  #href: string;
  #init: RequestInit;
  #listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();
  // One forwarding handler per subscribed named event, used to bridge events
  // from a native EventSource (GET mode) into the shared listener dispatch.
  #nativeForwarders: Map<string, EventListener> = new Map();
  #retry: boolean;
  #retryDelay: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #method: string;
  #minJitterValue: number;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #reconnectionTimerId: ReturnType<typeof setTimeout> | undefined;
  #isClosed: boolean = true;
  #generation = 0;
  #pendingMessages = 0;
  #maxPendingMessages: number;
  #messages: Promise<void> = Promise.resolve();
  #disposed = false;
  #attempt = 0;
  #messageSchema?: StandardSchemaV1<unknown, Data>;

  // Pure event field buffers (Reset dynamically at event dispatch boundaries)
  dataBuffer: string = "";
  lastEventId: string = "";
  eventTypeBuffer: string = "";

  /**
   * Constructor to initialize the EventSourceClient.
   * @param options Configuration options for the EventSourceClient.
   * @param params Connection parameters.
   */
  constructor(
    {
      url,
      baseURL,
      initialLastEventId = null,
      maxJitterValue = 1.2,
      maxRetryDelay = "1 minute",
      method = "GET",
      minJitterValue = 0.8,
      retry = false,
      retryDelay = "5 seconds",
      retryCount = 3,
      retryBackoffStrategy = "fixed",
      cache = "no-store",
      messageSchema,
      maxPendingMessages = 1000,
      ...init
    }: EventSourceClientOptions<Data>,
    params = {} as Params
  ) {
    this.#maxPendingMessages = maxPendingMessages;
    if (!Number.isInteger(maxPendingMessages) || maxPendingMessages < 1)
      throw new RangeError("maxPendingMessages must be a positive integer.");
    this.#cache = cache;
    this.#href = getUri({ url, baseURL, params });
    this.#lastEventId = initialLastEventId;
    this.lastEventId = initialLastEventId || "";
    this.#init = init;
    this.#method = method;
    this.#retry = retry;
    this.#retryDelay = time(retryDelay);
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = time(maxRetryDelay);
    this.#minJitterValue = minJitterValue;
    this.#retryCount = retryCount;
    this.#retryBackoffStrategy = retryBackoffStrategy;
    this.#messageSchema = messageSchema;
  }

  /**
   * Create an EventSource instance and set up event handlers.
   * @private
   */
  #createEventSource = () => {
    this.#eventSource = new EventSource(this.#href, {
      withCredentials: this.#init.credentials === "include",
    });

    const source = this.#eventSource;
    const generation = this.#generation;
    const current = () => !this.#isClosed && generation === this.#generation;
    this.#eventSource.onopen = () => {
      if (!current()) return;
      this.status = "open";
    };

    this.#eventSource.onmessage = (event) => {
      if (current()) this.#enqueueMessage(event, generation);
    };

    this.#eventSource.onerror = (error) => {
      if (!current()) return;
      this.#handleError(error);
      source.close();
      this.#generation += 1;
      this.#reconnect();
    };

    // Native EventSources only deliver events for names you subscribe to up
    // front, so re-attach one forwarder per subscribed named event. This runs
    // on every (re)connect because a fresh EventSource is created each time.
    this.#nativeForwarders.clear();
    this.#listeners.forEach((_, type) => this.#attachNativeForwarder(type));
  };

  /**
   * Connect using the fetch API and process the event stream.
   * @private
   */
  #connect = async () => {
    const generation = this.#generation;
    const requestInit = this.#initialize();
    try {
      const response = await fetch(this.#href, requestInit);
      if (this.#isClosed || generation !== this.#generation) {
        await response.body?.cancel();
        return;
      }
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) {
        this.#reconnect();
        return;
      }
      this.status = "open";
      await this.#readBody(response.body.getReader(), generation);
    } catch (error) {
      if (this.#isClosed || generation !== this.#generation) return;
      this.#handleError(error);
      this.#reconnect();
    }
  };

  /**
   * Process each field in the event stream.
   *
   * @param field The field name.
   * @param value The field value.
   *
   * @private
   */
  #processField = (field: string, value: string) => {
    switch (field) {
      case "event":
        this.eventTypeBuffer = value;
        break;
      case "data":
        this.dataBuffer += value + "\n";
        break;
      case "id":
        if (!value.includes("\u0000")) {
          this.lastEventId = value;
          this.#lastEventId = value;
        }
        break;
      case "retry":
        if (/^\d+$/.test(value)) {
          this.#retryDelay = parseInt(value, 10);
        }
        break;
    }
  };

  #processLine = async (line: string, generation: number) => {
    if (line === "") {
      await this.#dispatchEvent(generation);
    } else if (line.startsWith(":")) {
      // Intentionally ignored per WHATWG SSE Spec (Comment block)
    } else if (line.includes(":")) {
      const index = line.indexOf(":");
      const field = line.slice(0, index);
      let value = line.slice(index + 1);

      // Strict WHATWG Compliance: Strip exactly ONE leading space if present
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
      this.#processField(field, value);
    } else {
      this.#processField(line, "");
    }
  };

  #readBody = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    generation: number
  ): Promise<void> => {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!this.#isClosed && generation === this.#generation) {
        const { done, value } = await reader.read();
        if (this.#isClosed || generation !== this.#generation) return;
        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });
        let index: number;
        while ((index = buffer.search(/[\r\n]/)) >= 0) {
          if (!done && buffer[index] === "\r" && index === buffer.length - 1)
            break;
          const length = buffer.slice(index, index + 2) === "\r\n" ? 2 : 1;
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + length);
          await this.#processLine(line, generation);
          if (this.#isClosed || generation !== this.#generation) return;
        }
        if (done) {
          this.#reconnect();
          return;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  };

  /**
   * Dispatch the event to listeners.
   * @private
   */
  #dispatchEvent = async (generation: number) => {
    const payload = this.dataBuffer.endsWith("\n")
      ? this.dataBuffer.slice(0, -1)
      : this.dataBuffer;
    const type = this.eventTypeBuffer || "message";
    const hasData = this.dataBuffer !== "";
    const lastEventId = this.lastEventId;
    this.dataBuffer = "";
    this.eventTypeBuffer = "";
    if (hasData)
      await this.#handleMessage(payload, type, generation, lastEventId);
  };

  /**
   * Initialize the request.
   * @returns The initialized request.
   * @private
   */
  #initialize = () => {
    this.#abortController = new AbortController();

    const cache = this.#cache;
    const headers = new Headers(this.#init.headers);
    const signal = this.#abortController.signal;
    const method = this.#method;

    headers.set("Accept", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");

    if (this.#lastEventId) {
      headers.set("Last-Event-ID", this.#lastEventId);
    }

    const request = {
      headers,
      method,
      signal,
      cache,
    };

    return shallowMerge(this.#init, request);
  };

  /**
   * Reconnect logic with backoff strategy.
   * @private
   */
  #reconnect = () => {
    if (!this.#isClosed && this.#retry && this.#attempt < this.#retryCount) {
      clearTimeout(this.#reconnectionTimerId);

      const backoffDelay = this.#calculateBackoff();
      this.#reconnectionTimerId = setTimeout(() => {
        this.#reconnectionTimerId = undefined;
        if (this.#isClosed) return;

        this.#attempt += 1;
        this.#start();
      }, backoffDelay);
    }
  };

  /**
   * Calculate backoff delay.
   * @returns The calculated backoff delay.
   * @private
   */
  #calculateBackoff = (): number => {
    switch (this.#retryBackoffStrategy) {
      case "fixed":
        return Math.min(this.#retryDelay, this.#maxRetryDelay);
      case "exponential":
        const delay = Math.min(
          this.#retryDelay * Math.pow(2, this.#attempt),
          this.#maxRetryDelay
        );

        const jitterBufferValue = this.#maxJitterValue - this.#minJitterValue;
        const jitterBufferTarget = Math.random() * jitterBufferValue;
        const jitterFactor = this.#minJitterValue + jitterBufferTarget;

        return delay * jitterFactor;
    }
  };

  /**
   * Handle incoming messages.
   * @param payload The transport string coming in.
   * @param type The SSE event type (defaults to "message").
   * @private
   */
  #handleMessage = async (
    payload: string,
    type: string,
    generation: number,
    lastEventId: string
  ) => {
    const current = () => !this.#isClosed && generation === this.#generation;
    if (!current()) return;
    let data: string | Data = payload;

    if (this.#messageSchema) {
      try {
        const parsed = JSON.parse(payload);
        const result = this.#messageSchema["~standard"].validate(parsed);
        const resolved = await result;
        if (!current()) return;

        if (resolved.issues) {
          this.#handleError(
            new Error("EventSourceClient: schema validation failed", {
              cause: resolved.issues,
            })
          );
          return;
        }

        data = resolved.value;
      } catch (error) {
        if (!current()) return;
        this.#handleError(
          new Error("EventSourceClient: failed to parse SSE data as JSON", {
            cause: error,
          })
        );
        return;
      }
    }

    // A delivered event proves the stream is live again after a message-level
    // error flipped the status to "error".
    if (!current()) return;
    this.status = "open";
    this.error = null;
    this.lastEventId = lastEventId;
    this.#lastEventId = lastEventId;

    const event = new MessageEvent(type, {
      data,
      lastEventId,
      origin: new URL(this.#href).origin,
    });

    this.#listeners.forEach((listeners, eventName) => {
      if (eventName === type) {
        listeners.forEach((listener) => listener(event));
      }
    });
  };

  #enqueueMessage = (event: MessageEvent, generation: number) => {
    if (event.currentTarget && event.currentTarget !== this.#eventSource)
      return;
    const { data, type, lastEventId } = event;
    if (!this.#messageSchema) {
      void this.#handleMessage(String(data), type, generation, lastEventId);
      return;
    }
    if (this.#pendingMessages >= this.#maxPendingMessages) {
      this.close();
      this.#handleError(
        new RangeError("EventSourceClient: incoming message queue is full.")
      );
      return;
    }
    this.#pendingMessages += 1;
    this.#messages = this.#messages
      .then(() =>
        this.#handleMessage(String(data), type, generation, lastEventId)
      )
      .catch((error) => {
        if (!this.#isClosed && generation === this.#generation)
          this.#handleError(error);
      })
      .finally(() => {
        if (generation === this.#generation) this.#pendingMessages -= 1;
      });
  };

  /**
   * Handle errors.
   * @param error The error object.
   * @private
   */
  #handleError = (error: unknown) => {
    const failure = toError(error, "EventSource connection failed");
    this.error = failure;
    this.status = "error";

    const event = new MessageEvent("error", { data: failure });
    this.#listeners.forEach((listeners, eventName) => {
      if (eventName === "error") {
        listeners.forEach((listener) => listener(event));
      }
    });
  };

  /**
   * Subscribe to an SSE event. Returns an unsubscribe function.
   *
   * The store is keyed by the handler that was passed: each distinct handler
   * owns its own subscription, while registering the same handler again is a
   * no-op that returns the shared unsubscribe.
   */
  on = <Name extends string>(
    type: Name,
    listener: EventSourceListener<Data>
  ): (() => void) => {
    let listeners = this.#listeners.get(type);
    listeners ??= new Set();

    const eventListener = listener as (event: MessageEvent) => void;
    const isAbsent = !listeners.has(eventListener);

    listeners.add(eventListener);
    this.#listeners.set(type, listeners);

    // Native EventSources only deliver events for names subscribed to up
    // front, so ensure a forwarder exists for the native (GET) transport path.
    if (isAbsent) this.#attachNativeForwarder(type);

    return () => {
      if (!listeners.has(eventListener)) return;
      listeners.delete(eventListener);

      if (listeners.size === 0) {
        this.#listeners.delete(type);
        this.#detachNativeForwarder(type);
      }
    };
  };

  /**
   * Register (or reuse) a forwarding listener for a named event. The forwarder
   * re-enters the shared dispatch so the payload is schema-validated and routed
   * to every listener for that type. Native EventSources only deliver events
   * for names subscribed to up front, so registering before `open()` matters:
   * the forwarder is stored now and attached to each freshly created EventSource.
   */
  #attachNativeForwarder = (type: string) => {
    if (type === "message" || type === "error") return;
    if (this.#nativeForwarders.has(type)) return;

    const generation = this.#generation;
    const source = this.#eventSource;
    const forwarder = (event: MessageEvent) => {
      if (source !== this.#eventSource) return;
      this.#enqueueMessage(event, generation);
    };

    this.#nativeForwarders.set(type, forwarder as EventListener);
    this.#eventSource?.addEventListener(type, forwarder as EventListener);
  };

  #detachNativeForwarder = (type: string) => {
    const forwarder = this.#nativeForwarders.get(type);
    if (!forwarder) return;

    this.#nativeForwarders.delete(type);
    this.#eventSource?.removeEventListener(type, forwarder);
  };

  /**
   * An asynchronous generator function that yields `MessageEvent` objects.
   * This function continuously listens for "message" events and yields each event as it occurs.
   *
   * @async
   * @generator
   * @yields {MessageEvent} The next message event.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<MessageEvent<Data>> {
    while (true) {
      const event = await new Promise<MessageEvent<Data>>((resolve) => {
        let unsubscribe = () => {};
        const listener = (event: MessageEvent) => {
          unsubscribe();
          resolve(event);
        };
        unsubscribe = this.on("message", listener);
      });
      yield event;
    }
  }

  /**
   * Open the connection.
   */
  #start = () => {
    this.#generation += 1;
    this.#messages = Promise.resolve();
    this.#pendingMessages = 0;
    this.dataBuffer = "";
    this.eventTypeBuffer = "";
    this.status = "connecting";
    this.error = null;
    if (this.#method === "GET") this.#createEventSource();
    else void this.#connect();
  };

  open = () => {
    if (this.#disposed)
      throw new Error("EventSourceClient: this instance has been disposed.");
    if (
      !this.#isClosed &&
      (this.status === "open" || this.status === "connecting")
    )
      return;
    this.#isClosed = false;
    this.#attempt = 0;
    this.#start();
  };

  /**
   * Close the connection.
   */
  close = () => {
    this.#isClosed = true;
    this.#generation += 1;
    this.#messages = Promise.resolve();
    this.#pendingMessages = 0;
    clearTimeout(this.#reconnectionTimerId);

    this.#reconnectionTimerId = undefined;
    this.#abortController.abort();
    this.#eventSource?.close();
    this.#eventSource = null;
    this.status = "idle";
  };

  dispose = () => {
    this.close();
    this.#disposed = true;
    this.#listeners.clear();
    this.#nativeForwarders.clear();
  };
}

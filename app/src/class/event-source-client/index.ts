import { shallowMerge } from "@/functions/shallow-merge";
import { time } from "@/functions/time";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { EventSourceClientOptions } from "@/types/event-source/constructor";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export class EventSourceClient<
  Data = unknown,
  Params extends ConnectionParams = never,
> {
  #abortController: AbortController = new AbortController();
  #cache: string;
  #eventSource: EventSource | null = null;
  #lastEventId: string | null;
  #href: string;
  #init: RequestInit;
  #listeners: Map<string, (event: MessageEvent) => void> = new Map();
  #retry: boolean;
  #retryDelay: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #method: string;
  #minJitterValue: number;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #messageSchema?: StandardSchemaV1<Data>;

  // Dedicated stream slice staging tracker
  #lineBuffer: string = "";

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
      ...init
    }: EventSourceClientOptions<Data>,
    params = {} as Params
  ) {
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

    this.#eventSource.onmessage = (event) => {
      this.#handleMessage(event.data);
    };

    this.#eventSource.onerror = (error) => {
      this.#handleError(error);
      this.#eventSource?.close();
      this.#reconnect();
    };
  };

  /**
   * Connect using the fetch API and process the event stream.
   * @private
   */
  #connect = () => {
    const requestInit = this.#initialize();

    fetch(this.#href, requestInit)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body;
      })
      .then((body) => {
        if (!body) return this.#reconnect();
        if (body.getReader) this.#readBody(body.getReader());
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          console.log("Fetch aborted");
        } else {
          this.#handleError(error);
          this.#reconnect();
        }
      });
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
        }
        break;
      case "retry":
        if (/^\d+$/.test(value)) {
          this.#retryDelay = parseInt(value, 10);
        }
        break;
    }
  };

  #processLine = async (line: string) => {
    if (line === "") {
      await this.#dispatchEvent();
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
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<void> => {
    const decoder = new TextDecoder();

    const { done, value } = await reader.read();
    if (done) {
      this.#reconnect();
      return;
    }

    const chunk = decoder.decode(value, { stream: true });

    const lines = (this.#lineBuffer + chunk).split(/\r\n|\r|\n/);

    // Extract trailing incomplete block safely to avoid corrupting mutations
    this.#lineBuffer = lines.pop() || "";
    for (const line of lines) {
      await this.#processLine(line);
    }

    return this.#readBody(reader);
  };

  /**
   * Dispatch the event to listeners.
   * @private
   */
  #dispatchEvent = async () => {
    // Drop execution if the active data store registers empty
    if (this.dataBuffer === "") return;

    // Drop trailing carriage feed matching spec requirement
    if (this.dataBuffer.endsWith("\n")) {
      this.dataBuffer = this.dataBuffer.slice(0, -1);
    }

    let data: string | Data = this.dataBuffer;

    if (this.#messageSchema) {
      try {
        const parsed = JSON.parse(this.dataBuffer);
        const result = this.#messageSchema["~standard"].validate(parsed);

        const resolved = result instanceof Promise ? await result : result;

        if (resolved.issues) {
          this.#handleError(
            new Error("EventSourceClient: schema validation failed", {
              cause: resolved.issues,
            })
          );
          this.dataBuffer = "";
          this.eventTypeBuffer = "";
          return;
        }

        data = resolved.value;
      } catch (error) {
        this.#handleError(error);
        this.dataBuffer = "";
        this.eventTypeBuffer = "";

        return;
      }
    }

    const event = new MessageEvent(this.eventTypeBuffer || "message", {
      data,
      lastEventId: this.lastEventId,
      origin: new URL(this.#href).origin,
    });

    this.#listeners.forEach((listener, eventName) => {
      if (eventName === event.type) {
        listener(event);
      }
    });

    // Mandatory complete boundary reset
    this.dataBuffer = "";
    this.eventTypeBuffer = "";
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
    if (this.#retry && this.#retryCount > 0) {
      const backoffDelay = this.#calculateBackoff();
      setTimeout(() => {
        this.#retryCount -= 1;
        this.open();
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
          this.#retryDelay * Math.pow(2, this.#retryCount),
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
   * @private
   */
  #handleMessage = async (payload: string) => {
    let data: string | Data = payload;

    if (this.#messageSchema) {
      try {
        const parsed = JSON.parse(payload);
        const result = this.#messageSchema["~standard"].validate(parsed);
        const resolved = result instanceof Promise ? await result : result;

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
        this.#handleError(
          new Error("EventSourceClient: failed to parse SSE data as JSON", {
            cause: error,
          })
        );
        return;
      }
    }

    const event = new MessageEvent("message", { data });
    this.#listeners.forEach((listener, eventName) => {
      if (eventName === "message" || eventName === event.type) {
        listener(event);
      }
    });
  };

  /**
   * Handle errors.
   * @param error The error object.
   * @private
   */
  #handleError = (error: any) => {
    const event = new MessageEvent("error", { data: error });
    this.#listeners.forEach((listener, eventName) => {
      if (eventName === "error") listener(event);
    });
  };

  /**
   * Add an event listener.
   * @param type The event type.
   * @param listener The event listener.
   * @private
   */
  #addEventListener = <T extends "message" | (string & {})>(
    type: T,
    listener: T extends "message"
      ? (event: MessageEvent<Data>) => void
      : (event: MessageEvent<any>) => void
  ) => {
    this.#listeners.set(type, listener as (event: MessageEvent) => void);
  };

  /**
   * Remove an event listener.
   * @param type The event type.
   * @private
   */
  #removeEventListener = (type: string) => {
    this.#listeners.delete(type);
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
        const listener = (event: MessageEvent) => {
          this.#removeEventListener("message");
          resolve(event);
        };
        this.#addEventListener("message", listener);
      });
      yield event;
    }
  }

  /**
   * Open the connection.
   */
  open = () => {
    if (this.#method === "GET") this.#createEventSource();
    else this.#connect();
  };

  /**
   * Close the connection.
   */
  close = () => {
    this.#abortController.abort();
    this.#eventSource?.close();
    this.#eventSource = null;
  };
}

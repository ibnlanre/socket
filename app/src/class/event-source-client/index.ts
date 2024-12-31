import { shallowMerge } from "@/functions/shallow-merge";
import { toMs } from "@/functions/to-ms";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { EventSourceClientOptions } from "@/types/event-source/constructor";

/**
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export class EventSourceClient<
  Events extends Record<string, unknown>,
  Params extends ConnectionParams = never
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

  data: string = "";
  lastEventId: string = "";
  eventType: string = "";

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
      ...init
    }: EventSourceClientOptions,
    params = <Params>{}
  ) {
    this.#cache = cache;
    this.#href = getUri({ url, baseURL, params });
    this.#lastEventId = initialLastEventId;
    this.#init = init;
    this.#method = method;
    this.#retry = retry;
    this.#retryDelay = toMs(retryDelay);
    this.#maxJitterValue = maxJitterValue;
    this.#maxRetryDelay = toMs(maxRetryDelay);
    this.#minJitterValue = minJitterValue;
    this.#retryCount = retryCount;
    this.#retryBackoffStrategy = retryBackoffStrategy;
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
        this.eventType = value;
        break;
      case "data":
        this.data += value + "\n";
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
      default:
        break;
    }
  };

  #processLine = (line: string) => {
    if (line === "") {
      this.#dispatchEvent();
      this.data = "";
      this.eventType = "";
    } else if (line.startsWith(":")) {
      // Ignore the line
    } else if (line.includes(":")) {
      const [field, ...data] = line.split(":");
      const value = data.join(":").trimStart();
      this.#processField(field, value);
    } else {
      this.#processField(line, "");
    }
  };

  #readBody = (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    return reader.read().then(({ done, value }) => {
      if (done) {
        this.#reconnect();
        return;
      }

      const decoder = new TextDecoder();
      const text = decoder.decode(value, { stream: true });

      /**
       * Splits the concatenated string of `this.data` and `text` into an array of lines.
       * The splitting is done based on different newline characters: `\r\n`, `\r`, or `\n`.
       *
       * @example
       * ```typescript
       * this.data = "Hello\r\nWorld";
       * const text = "\nNew Line";
       * const lines = (this.data + text).split(/\r\n|\r|\n/);
       * // lines will be ["Hello", "World", "", "New Line"]
       * ```
       */
      const lines = (this.data + text).split(/\r\n|\r|\n/);

      this.data = lines.pop() || "";
      lines.forEach(this.#processLine);

      return this.#readBody(reader);
    });
  };

  /**
   * Dispatch the event to listeners.
   * @private
   */
  #dispatchEvent = () => {
    if (this.data === "") return;

    if (this.data.endsWith("\n")) {
      this.data = this.data.slice(0, -1);
    }

    const event = new MessageEvent(this.eventType || "message", {
      data: this.data,
      lastEventId: this.lastEventId,
      origin: new URL(this.#href).origin,
    });

    this.#listeners.forEach((listener, eventName) => {
      if (eventName === event.type) {
        listener(event);
      }
    });
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
   * @param data The message data.
   * @private
   */
  #handleMessage = (data: string) => {
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
  #addEventListener = <K extends keyof Events>(
    type: K,
    listener: (event: MessageEvent<Events[K]>) => void
  ) => {
    this.#listeners.set(<string>type, <(event: MessageEvent) => void>listener);
  };

  /**
   * Remove an event listener.
   * @param type The event type.
   * @private
   */
  #removeEventListener = <K extends keyof Events>(type: K) => {
    this.#listeners.delete(<string>type);
  };

  /**
   * An asynchronous generator function that yields `MessageEvent` objects.
   * This function continuously listens for "message" events and yields each event as it occurs.
   *
   * @async
   * @generator
   * @yields {MessageEvent} The next message event.
   */
  async *[Symbol.asyncIterator]() {
    while (true) {
      const event = await new Promise<MessageEvent<Events["message"]>>(
        (resolve) => {
          const listener = (event: MessageEvent) => {
            this.#removeEventListener("message");
            resolve(event);
          };
          this.#addEventListener("message", listener);
        }
      );
      yield event;
    }
  }

  /**
   * Open the connection.
   */
  open = () => {
    if (this.#init.method === "GET") this.#createEventSource();
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

// Example usage
const eventSourceClient = new EventSourceClient<{
  message: string;
}>({
  url: "/events",
  retry: true,
  retryCount: 10,
  retryDelay: "5 seconds",
  retryBackoffStrategy: "exponential",
});

eventSourceClient.open();

for await (const event of eventSourceClient) {
  console.log(event.data);
}

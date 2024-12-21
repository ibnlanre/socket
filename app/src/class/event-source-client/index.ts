import { shallowMerge } from "@/functions/shallow-merge";
import { toMs } from "@/functions/to-ms";
import { getUri } from "@/library/get-uri";

import type { ConnectionParams } from "@/types/connection-params";
import type { EventSourceClientOptions } from "@/types/event-source/constructor";

export class EventSourceClient<
  Events extends Record<string, unknown>,
  Params extends ConnectionParams = never
> {
  #cache: string;
  #eventSource: EventSource | null = null;
  #lastEventId: string | null;
  #method: string;
  #href: string;
  #init: RequestInit;
  #listeners: Map<string, (event: MessageEvent) => void> = new Map();
  #retry: boolean;
  #retryDelay: number;
  #maxJitterValue: number;
  #maxRetryDelay: number;
  #minJitterValue: number;
  #retryCount: number;
  #retryBackoffStrategy: "fixed" | "exponential";
  #abortController: AbortController = new AbortController();

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
    params = {} as Params
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

  #createEventSource() {
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
  }

  #connect() {
    const requestInit = this.#initialize();

    fetch(this.#href, requestInit)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body;
      })
      .then((body) => {
        if (!body) {
          throw new Error("ReadableStream is not supported in this browser.");
        }

        if (body.getReader) {
          const reader = body.getReader();
          const decoder = new TextDecoder();
          const read = () => {
            reader.read().then(({ done, value }) => {
              if (done) {
                this.#reconnect();
                return;
              }
              const text = decoder.decode(value, { stream: true });
              this.#handleMessage(text);
              read();
            });
          };
          read();
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          console.log("Fetch aborted");
        } else {
          this.#handleError(error);
          this.#reconnect();
        }
      });
  }

  #initialize() {
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
  }

  #reconnect() {
    if (this.#retry && this.#retryCount > 0) {
      const backoffDelay = this.#calculateBackoff();
      setTimeout(() => {
        this.#retryCount -= 1;
        this.open();
      }, backoffDelay);
    }
  }

  #calculateBackoff(): number {
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
  }

  #handleMessage(data: string) {
    const event = new MessageEvent("message", { data });
    this.#listeners.forEach((listener, eventName) => {
      if (eventName === "message" || eventName === event.type) {
        listener(event);
      }
    });
  }

  #handleError(error: any) {
    const event = new MessageEvent("error", { data: error });
    this.#listeners.forEach((listener, eventName) => {
      if (eventName === "error") {
        listener(event);
      }
    });
  }

  #addEventListener<K extends keyof Events>(
    type: K,
    listener: (event: MessageEvent<Events[K]>) => void
  ) {
    this.#listeners.set(
      type as string,
      listener as (event: MessageEvent) => void
    );
  }

  #removeEventListener<K extends keyof Events>(type: K) {
    this.#listeners.delete(type as string);
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const event = await new Promise<MessageEvent>((resolve) => {
        const listener = (event: MessageEvent) => {
          this.#removeEventListener("message");
          resolve(event);
        };
        this.#addEventListener("message", listener);
      });
      yield event;
    }
  }

  open() {
    if (this.#init.method === "GET") this.#createEventSource();
    else this.#connect();
  }

  close() {
    this.#abortController.abort();
    this.#eventSource?.close();
    this.#eventSource = null;
  }
}

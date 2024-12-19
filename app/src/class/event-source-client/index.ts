import type { EventSourceClientOptions } from "@/types/event-source-options";
import type { UnitValue } from "@/types/socket-time-unit";

type ReconnectionPolicy = {
  retry?: boolean;
  retryDelay?: number;
  retryCount?: number;
  retryBackoffStrategy?: "exponential" | "linear";
  maxRetryDelay?: UnitValue;
  minJitterValue?: number;
  maxJitterValue?: number;
  jitterStrategy?: "fixed" | "full";
};

class EventSourceClient<TEvents extends Record<string, any>> {
  private url: string;
  private options: EventSourceClientOptions;
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private listeners: Map<string, (event: MessageEvent) => void> = new Map();

  constructor({
    url,

    initialLastEventId,

    ...init
  }: EventSourceClientOptions) {
    this.url = url;
    this.options = options;
    this.lastEventId = options.initialLastEventId || null;
  }

  private createEventSource() {
    const headers = new Headers(this.options.headers);
    if (this.lastEventId) {
      headers.append("Last-Event-ID", this.lastEventId);
    }

    const fetchOptions: RequestInit = {
      method: this.options.method || "GET",
      headers: headers,
      body: this.options.body,
    };

    fetch(this.url, fetchOptions)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body;
      })
      .then((body) => {
        const reader = body?.getReader();
        const decoder = new TextDecoder();
        const read = () => {
          reader?.read().then(({ done, value }) => {
            if (done) {
              this.reconnect();
              return;
            }
            const text = decoder.decode(value, { stream: true });
            this.handleMessage(text);
            read();
          });
        };
        read();
      })
      .catch((error) => {
        this.handleError(error);
        this.reconnect();
      });
  }

  private reconnect() {
    const policy = this.options.reconnectionPolicy || {
      retries: 3,
      delay: 1000,
    };
    if (policy.retries > 0) {
      setTimeout(() => {
        this.options.reconnectionPolicy!.retries -= 1;
        this.createEventSource();
      }, policy.delay);
    }
  }

  private handleMessage(data: string) {
    const event = new MessageEvent("message", { data });
    this.listeners.forEach((listener, eventName) => {
      if (eventName === "message" || eventName === event.type) {
        listener(event);
      }
    });
  }

  private handleError(error: any) {
    const event = new MessageEvent("error", { data: error });
    this.listeners.forEach((listener, eventName) => {
      if (eventName === "error") {
        listener(event);
      }
    });
  }

  public addEventListener<K extends keyof TEvents>(
    type: K,
    listener: (event: MessageEvent<TEvents[K]>) => void
  ) {
    this.listeners.set(
      type as string,
      listener as (event: MessageEvent) => void
    );
  }

  public removeEventListener<K extends keyof TEvents>(type: K) {
    this.listeners.delete(type as string);
  }

  public async *[Symbol.asyncIterator]() {
    while (true) {
      const event = await new Promise<MessageEvent>((resolve) => {
        const listener = (event: MessageEvent) => {
          this.removeEventListener("message");
          resolve(event);
        };
        this.addEventListener("message", listener);
      });
      yield event;
    }
  }

  public start() {
    this.createEventSource();
  }

  public stop() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

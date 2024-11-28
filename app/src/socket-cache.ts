import type { SocketEvent } from "./types/socket-event";

export class SocketCache<State> {
  static isAvailable: boolean = "caches" in self;

  state: State | undefined;

  #url: string;
  #subscribers: Set<Function>;
  #cacheManager: CacheManager<State>;
  #logError: SocketEvent[];
  #path: string;

  constructor(url: string, path: string, logError: SocketEvent[] = []) {
    this.#url = url;
    this.#subscribers = new Set();
    this.#cacheManager = new CacheManager<State>(url);
    this.#logError = logError;
    this.#path = path;
  }

  #notifySubscribers = () => {
    this.#subscribers.forEach((callback) => {
      try {
        callback(this.state);
      } catch (error) {
        if (!this.#logError.includes("notification")) return;
        console.error("Error notifying subscriber", error);
      }
    });
  };

  get value(): State | undefined {
    return this.state;
  }

  next = async (path: string, value: State) => {
    try {
      if (!Object.is(this.state, value)) {
        this.state = value;
        await this.#cacheManager.set(this.#path, value);
        this.#notifySubscribers();
      }
    } catch (error) {
      if (!this.#logError.includes("update")) return;
      console.error("Error updating state", error);
    }
  };

  subscribe = (
    observer: (value: State | undefined) => unknown,
    immediate: boolean = true
  ) => {
    if (!this.#subscribers.has(observer)) {
      this.#subscribers.add(observer);
      if (immediate) observer(this.state);
    }

    return () => {
      this.#subscribers.delete(observer);
    };
  };

  unsubscribe = (): void => {
    this.#subscribers.clear();
  };
}

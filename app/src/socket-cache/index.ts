import { CacheManager } from "@/cache-manager";
import type { SocketEvent } from "@/types/socket-event";

export class SocketCache<State> {
  static isAvailable: boolean = "caches" in self;

  #state: State | undefined;
  #subscribers: Set<Function>;
  #cacheManager: CacheManager<State>;
  #logError: SocketEvent[];
  #path: string;

  constructor(url: string, path: string, logError: SocketEvent[] = []) {
    this.#subscribers = new Set();
    this.#cacheManager = new CacheManager<State>(url);
    this.#logError = logError;
    this.#path = path;
  }

  /**
   * Notifies all subscribers with the current value.
   * @protected
   */
  #notifySubscribers = () => {
    this.#subscribers.forEach((callback) => {
      try {
        callback(this.#state);
      } catch (error) {
        if (!this.#logError.includes("notification")) return;
        console.error("Error notifying subscriber", error);
      }
    });
  };

  /**
   * Returns the current value of the subject.
   * @returns {State} The current value.
   */
  get value(): State | undefined {
    return this.#state;
  }

  /**
   * Update the state using the provided value.
   * @description Emits a new value to the subject and notifies subscribers.
   * @description If the value is the same as the current state, no updates are made.
   * @description If an error occurs during the update, the error is logged to the console.
   *
   * @template State The type of the state.
   *
   * @param {State} value Value to update the state with.
   * @returns void
   */
  next = async (value: State) => {
    try {
      if (!Object.is(this.#state, value)) {
        this.#state = value;
        await this.#cacheManager.set(this.#path, value);
        this.#notifySubscribers();
      }
    } catch (error) {
      if (!this.#logError.includes("update")) return;
      console.error("Error updating state", error);
    }
  };

  /**
   * Subscribes to the subject and receives emitted values.
   * @param {Function} observer The callback function to be called with emitted values.
   * @param {boolean} [immediate=true] Whether to run the callback immediately with the current state. Defaults to `true`.
   *
   * @description
   * When immediate is true, the callback will execute immediately with the current state.
   * When immediate is false or not provided, the callback will only execute after a change has occurred.
   *
   * @returns {{ unsubscribe: Function }} An object with a function to unsubscribe the callback.
   */
  subscribe = (
    observer: (value: State | undefined) => unknown,
    immediate: boolean = true
  ) => {
    if (!this.#subscribers.has(observer)) {
      this.#subscribers.add(observer);
      if (immediate) observer(this.#state);
    }

    return () => {
      this.#subscribers.delete(observer);
    };
  };

  /**
   * Unsubscribes all subscribers from the subject.
   */
  unsubscribe = (): void => {
    this.#subscribers.clear();
  };
}

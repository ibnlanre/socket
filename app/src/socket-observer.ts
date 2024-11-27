/**
 * Represents the type of a subscription to a `Subject`.
 */
export type Subscription = {
  /**
   * Unsubscribes the callback from receiving further updates.
   */
  unsubscribe: () => void;
};

abstract class Subject<State> {
  abstract get value(): State | undefined;
  abstract next(value: State): void;
  abstract subscribe(
    observer: (value: State | undefined) => void
  ): Subscription;
  abstract unsubscribe(): void;
}

/**
 * Represents a subject that maintains a current value and emits it to subscribers.
 * @template State The type of the initial and emitted values.
 */
export class SocketObserver<State> implements Subject<State> {
  private state: State | undefined = undefined;
  private subscribers: Set<Function>;
  private logError: boolean;

  /**
   * Creates a new instance of Dimension.
   * @param {State} initialValue The initial value of the subject.
   */
  constructor(logError: boolean = false) {
    /**
     * The set of subscribers to the subject.
     * @type {Set<Function>}
     */
    this.subscribers = new Set();

    /**
     * Whether to log the subject.
     * @type {boolean}
     */
    this.logError = logError;
  }

  /**
   * Notifies all subscribers with the current value.
   * @protected
   */
  protected notifySubscribers = () => {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.state);
      } catch (error) {
        if (!this.logError) return;
        console.error("Error notifying subscriber", error);
      }
    });
  };

  /**
   * Returns the current value of the subject.
   * @returns {State} The current value.
   */
  get value(): State | undefined {
    return this.state;
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
  next = (value: State) => {
    try {
      if (!Object.is(this.state, value)) {
        this.state = value;
        this.notifySubscribers();
      }
    } catch (error) {
      if (!this.logError) return;
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
  ): Subscription => {
    // Confirm the callback isn't in the subscribers list.
    if (!this.subscribers.has(observer)) {
      // Add the callback as a member in the subscribers list.
      this.subscribers.add(observer);
      if (immediate) observer(this.state);
    }

    return {
      unsubscribe: () => {
        this.subscribers.delete(observer);
      },
    };
  };

  /**
   * Unsubscribes all subscribers from the subject.
   */
  unsubscribe = (): void => {
    this.subscribers.clear();
  };
}

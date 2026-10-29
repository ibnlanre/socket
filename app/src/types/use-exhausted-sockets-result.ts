/** What `useExhaustedSockets` returns. */
export interface UseExhaustedSocketsResult {
  /** How many sockets, across the clients, have stopped and wait to be reopened. */
  count: number;
  /**
   * Whether `reconnect()` is under way: from the first reopening until each
   * socket has connected or stopped again.
   */
  isReconnecting: boolean;
  /**
   * Reopen them all, one after another, `stagger` apart. Resolves once each
   * has connected or stopped again, with how many connected.
   */
  reconnect: () => Promise<number>;
}

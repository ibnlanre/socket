/** What `useExhaustedSockets` returns. */
export interface UseExhaustedSocketsResult {
  /** How many sockets, across the clients, have stopped and are still read. */
  count: number;
  /** Whether `reconnect()` is reopening them now. */
  isReconnecting: boolean;
  /** Reopen them all, one after another, `stagger` apart. */
  reconnect: () => Promise<number>;
}

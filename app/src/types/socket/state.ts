import type { SocketFetchStatus } from "./fetch-status";
import type { SocketStatus } from "./status";

/**
 * The reactive state a {@link Socket} exposes to callers.
 *
 * Every member is `readonly`: a `Socket` implements this interface directly
 * (mutating its own backing fields internally), while consumers only ever read
 * through it. The React hook result and any other consumer build on top of it
 * by extending it, so the surface never has to be carved out of the full socket
 * class with `Pick`/`Omit`.
 */
export interface SocketState<Get> {
  /** Preferred representation for inbound binary frames. */
  readonly binaryType: "blob" | "arraybuffer";
  /** Timestamp (ms) of the last successful data update. */
  readonly dataUpdatedAt: number;
  /** The most recent connection or message error, if any. */
  readonly error: Error | null;
  /** Timestamp (ms) of the most recent error. */
  readonly errorUpdatedAt: number;
  /** Number of consecutive failed connection attempts. */
  readonly failureCount: number;
  /** Human-readable reason for the most recent failure. */
  readonly failureReason: string | null;
  /** Low-level connection phase: idle, connecting, connected, or disconnected. */
  readonly fetchStatus: SocketFetchStatus;
  /** Whether the transport is currently connected. */
  readonly isConnected: boolean;
  /** Whether the transport is currently establishing a connection. */
  readonly isConnecting: boolean;
  /** Whether the transport is currently disconnected. */
  readonly isDisconnected: boolean;
  /** Whether the socket is in an error state. */
  readonly isError: boolean;
  /** Whether the socket has never opened a connection. */
  readonly isIdle: boolean;
  /** Whether the socket is loading its first payload. */
  readonly isLoading: boolean;
  /** Whether no live data is available yet (or placeholder data is shown). */
  readonly isPending: boolean;
  /** Whether the current value is placeholder data. */
  readonly isPlaceholderData: boolean;
  /** Whether the latest attempt failed after a previous success. */
  readonly isRefetchError: boolean;
  /** Whether a refetch (reconnect) is currently in flight. */
  readonly isRefetching: boolean;
  /** Whether the socket is presenting stale/cached data. */
  readonly isStaleData: boolean;
  /** Whether the latest message was parsed and stored successfully. */
  readonly isSuccess: boolean;
  /** High-level lifecycle: idle, stale, loading, success, or error. */
  readonly status: SocketStatus;
  /** The latest parsed message value. */
  readonly value: Get | undefined;
}

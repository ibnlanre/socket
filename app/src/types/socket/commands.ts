import type { UnitValue } from "@/types/time-unit";

import type { SocketConnectionEvent } from "./connection-event";
import type { SocketListener } from "./listener";

/**
 * The imperative commands a {@link Socket} exposes to callers.
 *
 * A `Socket` implements this interface directly; consumers build on top of it
 * by extending it rather than carving methods out of the full socket class.
 */
export interface SocketCommands<Post> {
  /** Explicitly close the connection and tear down transport-level listeners. */
  close: () => void;
  /** Subscribe to a native WebSocket event. Returns an unsubscribe function. */
  on: SocketListener;
  /** Open (or re-open) the connection. No-op when already open. */
  open: () => void;
  /** Send a JSON payload. Returns false when deduplicated within the window. */
  send: (payload: Post) => boolean;
  /** Resolve once the socket reaches the given connection state. */
  waitUntil: (
    state: SocketConnectionEvent,
    timeout?: UnitValue
  ) => Promise<void>;
}

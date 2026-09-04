import type { SocketCommands } from "./socket/commands";
import type { SocketState } from "./socket/state";

/**
 * The result of the `useSocket` React hook.
 *
 * Composed by extending the narrow `SocketState` and `SocketCommands`
 * interfaces that a `Socket` already implements, so the hook surface can never
 * drift from the transport without a compile error — no `Pick`/`Omit` off the
 * full class and no `Params`, which nothing in this result type references.
 */
export interface UseSocketResult<Get = unknown, Post = never, State = Get>
  extends SocketState<Get>, SocketCommands<Post> {
  /**
   * The latest selected data received from the socket.
   */
  readonly data: State;
}

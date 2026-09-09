import type { SocketState } from "./socket/state";

/** A component's subscription state. Transport ownership stays with the client. */
export interface UseSocketResult<Get = unknown, Post = never, State = Get | undefined>
  extends SocketState<Get> {
  readonly data: State;
  /** Wait for this subscription to resolve, then validate and accept a send. */
  send: (payload: Post, options?: { signal?: AbortSignal }) => Promise<boolean>;
}

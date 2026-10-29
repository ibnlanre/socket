import type { SocketSelector } from "./selector";

export type UseSocketOptions<Get = unknown, State = Get, Params = never> = {
  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Data the caller already has, such as a snapshot fetched on the server.
   *
   * @description The value while server rendering and until the socket has
   * its own; a stored copy does not replace it. Unlike `placeholderData`, it
   * is real data. Read once, when the subscription starts.
   */
  initialData?: Get;

  /**
   * The URL params used for the connection.
   */
  params?: Params;

  /**
   * A function to select a part of the state returned by the hook.
   *
   * @description By default, the entire state is returned
   */
  select?: SocketSelector<Get, State>;
};

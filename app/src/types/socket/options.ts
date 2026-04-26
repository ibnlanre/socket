import type { ConnectionParams } from "../connection-params";
import type { SocketSelector } from "./selector";

export type SocketOptions<Params extends ConnectionParams = never> = {
  params?: Params;
};

export type UseSocketOptions<
  Get = unknown,
  State = Get,
  Params extends ConnectionParams = never,
> = SocketOptions<Params> & {
  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * The initial state returned by the hook before the first successful message is received.
   */
  initialData?: State;

  /**
   * A function to select a part of the state returned by the hook.
   *
   * @description By default, the entire state is returned
   */
  select?: SocketSelector<Get, State>;
};

import type { ConnectionParams } from "../connection-params";
import type { SocketSelector } from "./selector";

export type UseSocketOptions<
  Get = unknown,
  State = Get,
  Params extends ConnectionParams = never,
> = {
  /**
   * The URL params used for the connection.
   */
  params?: Params;

  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * A function to select a part of the state returned by the hook.
   *
   * @description By default, the entire state is returned
   */
  select?: SocketSelector<Get, State>;
};

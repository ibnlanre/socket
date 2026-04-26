import type { SocketClient } from "@/class/socket-client";
import type { ConnectionParams } from "./connection-params";

export type UseSocketResult<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  State = Get,
> = SocketClient<Get, Post, Params> & {
  /**
   * The latest data received from the socket.
   */
  data: State;
};

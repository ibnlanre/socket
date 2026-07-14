import type { Socket } from "@/class/socket";
import type { ConnectionParams } from "./connection-params";

export type UseSocketResult<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  State = Get,
> = Socket<Get, Post, Params> & {
  /**
   * The latest data received from the socket.
   */
  data: State;
};

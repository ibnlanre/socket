import type { SocketClient } from "@/class/socket-client";
import type { ConnectionParams } from "./connection-params";

export interface UseSocketResult<
  Get = unknown,
  Params extends ConnectionParams = never,
  Post = never,
  State = Get
> extends SocketClient<Get, Params, Post> {
  data: State;
}

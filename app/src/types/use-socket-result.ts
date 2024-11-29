import type { SocketClient } from "@/socket-client/index silly";
import type { SocketParams } from "./socket-params";

export interface UseSocketResult<
  Get = unknown,
  Params extends SocketParams = never,
  Post = never,
  State = Get
> extends SocketClient<Get, Params, Post> {
  data: State;
}

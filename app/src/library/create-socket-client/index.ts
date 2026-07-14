import type { ConnectionParams } from "@/types/connection-params";
import type { SocketConstructor } from "@/types/socket/constructor";

import { SocketClient } from "@/class/socket-client";

export function createSocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
>(configuration: SocketConstructor<Get, Post, Params>) {
  return new SocketClient(configuration);
}

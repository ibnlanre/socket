import type { Socket } from "@/class/socket";
import type { ConnectionParams } from "@/types/connection-params";

export type SocketSubscriber<Get, Post, Params extends ConnectionParams> = (
  client: Socket<Get, Post, Params>
) => void;

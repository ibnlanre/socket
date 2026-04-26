import type { SocketClient } from "@/class/socket-client";
import type { ConnectionParams } from "@/types/connection-params";

export type SocketClientSubscriber<
  Get,
  Post,
  Params extends ConnectionParams,
> = (client: SocketClient<Get, Post, Params>) => void;

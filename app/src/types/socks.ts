import { SocketClient } from "@/socket-client/index silly";

/**
 * A map of previous connections
 * @description This is useful for reconnecting to previous connections
 *
 * @default
 * new Map<string, SocketClient>()
 */
export type Socks = Map<string, SocketClient>;

import type { Socket } from "@/class/socket";

/**
 * A map of previous connections
 * @description This is useful for reconnecting to previous connections
 *
 * @default
 * new Map<string, Socket>()
 */
export type Socks = Map<string, Socket>;

import type { SocketPrimitives } from "./socket-primitives";

export type SocketParamValue = SocketPrimitives | SocketPrimitives[];
export type SocketParams = Record<string, SocketParamValue>;

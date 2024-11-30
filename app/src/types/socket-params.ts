import type { SocketPrimitiveType } from "./socket-primitive-type";

export type SocketParamValue = SocketPrimitiveType | SocketPrimitiveType[];
export type SocketParams = Record<string, SocketParamValue>;

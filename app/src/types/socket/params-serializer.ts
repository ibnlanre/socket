import type { ConnectionParams } from "../connection-params";

export type SocketParamsSerializer = (params: ConnectionParams) => string;

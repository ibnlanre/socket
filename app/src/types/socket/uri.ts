import type { ConnectionParams } from "../connection-params";

export type SocketURI = {
  baseURL?: string;
  params?: ConnectionParams;
  url: string;
};

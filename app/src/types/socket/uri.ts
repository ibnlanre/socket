import type { ConnectionParams } from "../connection-params";

export type SocketURI = {
  url: string;
  baseURL?: string;
  params?: ConnectionParams;
};

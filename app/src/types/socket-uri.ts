import type { SocketParams } from "./socket-params";

export type SocketURI = {
  url: string;
  baseURL?: string;
  params?: SocketParams;
};

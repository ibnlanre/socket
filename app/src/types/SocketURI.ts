import type { SocketParams } from "./SocketParams";

export type SocketURI = {
  url: string;
  baseURL?: string;
  params?: SocketParams;
};

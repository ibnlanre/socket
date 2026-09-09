import type { SocketConstructor } from "./constructor";

export interface SocketClientConstructor<
  Get = unknown,
  Post = never,
  Params = never,
  ParamsInput = Params,
> extends SocketConstructor<Get, Post, Params, ParamsInput> {
  /** Maximum retained connection identities. Evict unused entries to make room. @default 1000 */
  maxPoolSize?: number;
}

import type { SocketCacheError, SocketEvent } from "./socket-event";
import type { SocketRetrial } from "./socket-retrial";

export interface SocketConstructor<Get = unknown, Post = never>
  extends SocketRetrial {
  /**
   * The URL to connect to
   */
  url: string;

  /**
   * The events to log in the console
   *
   * @default
   * ["open", "close", "error"]
   */
  log?: SocketEvent[];

  /**
   * The events to log in the cache
   *
   * @default
   * ["initialization"]
   */
  cacheLog?: SocketCacheError[];

  /**
   * Whether to cache the data or not
   *
   * @default false
   */
  clearCacheOnClose?: boolean;

  /**
   * A custom condition for logging
   *
   * @default (logType) => process.env.NODE_ENV === "development"
   */
  logCondition?: (logType: SocketEvent) => boolean;

  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;

  /**
   * A custom function to encrypt the data before sending it
   *
   * @default (payload) => payload
   */
  encryptPayload?: (data: Post) => Post;

  /**
   * A custom function to decrypt the data after receiving it
   *
   * @default (data) => data
   */
  decryptData?: (data: Get) => Get;

  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;
}

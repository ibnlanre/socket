import type { SocketCache } from "./SocketCache";
import type { SocketEvent } from "./SocketEvent";

export type SocketConstructor = {
  /**
   * The events to log in the console
   *
   * @default ["open", "close", "error"]
   */
  log?: SocketEvent[];
  /**
   * Whether to retry the WebSocket connection or not
   *
   * @default false
   */
  retry?: boolean;
  /**
   * The delay in milliseconds before retrying the WebSocket connection
   *
   * @default 1000
   */
  retryDelay?: number;
  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;
} & SocketCache;

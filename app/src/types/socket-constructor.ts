import type { SocketCache } from "./socket-cache";
import type { SocketEvent } from "./socket-event";
import type { SocketRetrial } from "./socket-retrial";

export interface SocketConstructor extends SocketRetrial, SocketCache {
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
   * A custom condition for logging
   *
   * @default
   * (logType) => process.env.NODE_ENV === "development"
   */
  logCondition?: (logType: SocketEvent) => boolean;

  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;
}

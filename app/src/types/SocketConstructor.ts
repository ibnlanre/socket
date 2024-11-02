import type { SocketCache } from "./SocketCache";
import type { SocketEvent } from "./SocketEvent";
import type { SocketRetrial } from "./SocketRetrial";

export interface SocketConstructor extends SocketRetrial, SocketCache {
  /**
   * The events to log in the console
   *
   * @default ["open", "close", "error"]
   */
  log?: SocketEvent[];

  /**
   * A custom condition for logging
   *
   * @default (logType) => process.env.NODE_ENV === "development"
   */
  logCondition?: (logType: SocketEvent) => boolean;
}

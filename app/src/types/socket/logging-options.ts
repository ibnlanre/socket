import type { SocketConnectionEvent } from "./connection-event";

export type SocketLoggingOptions = {
  /**
   * The events to log in the console
   *
   * @default
   * ["open", "close", "error"]
   */
  log?: SocketConnectionEvent[];

  /**
   * A custom condition for logging
   *
   * @default (logType) => process.env.NODE_ENV === "development"
   */
  logCondition?: (logType: SocketConnectionEvent) => boolean;
};

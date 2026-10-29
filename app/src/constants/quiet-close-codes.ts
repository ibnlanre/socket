import { SocketCloseCode } from "./socket-close-code";

/**
 * Clean close codes that end a connection rather than report a fault: a
 * normal close, a going away, and a close without a status. Any other code,
 * sent cleanly or not, is a failure.
 */
export const QuietCloseCodes: readonly number[] = [
  SocketCloseCode.NORMAL_CLOSURE,
  SocketCloseCode.GOING_AWAY,
  SocketCloseCode.NO_STATUS_RECEIVED,
];

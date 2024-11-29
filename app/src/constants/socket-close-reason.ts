import { SocketCloseCode } from "./socket-close-code";

export const SocketCloseReason = {
  [SocketCloseCode.NORMAL_CLOSURE]: "The connection was closed cleanly",
  [SocketCloseCode.GOING_AWAY]:
    "The endpoint is going away, such as a server going down or a browser having navigated away from a page",
  [SocketCloseCode.PROTOCOL_ERROR]: "A protocol error occurred",
  [SocketCloseCode.UNSUPPORTED_DATA]: "The received data type is not supported",
  [SocketCloseCode.NO_STATUS_RECEIVED]:
    "No status code was provided even though one was expected",
  [SocketCloseCode.ABNORMAL_CLOSURE]:
    "The connection was closed abnormally, without a close frame being sent",
  [SocketCloseCode.INVALID_PAYLOAD_DATA]:
    "The received data could not be interpreted as expected",
  [SocketCloseCode.POLICY_VIOLATION]: "A policy violation occurred",
  [SocketCloseCode.MESSAGE_TOO_BIG]:
    "The received message is too big to process",
  [SocketCloseCode.MANDATORY_EXTENSION]: "A mandatory extension is missing",
  [SocketCloseCode.INTERNAL_SERVER_ERROR]: "An internal server error occurred",
  [SocketCloseCode.SERVICE_RESTART]: "The server is restarting",
  [SocketCloseCode.TRY_AGAIN_LATER]:
    "The server is overloaded, try again later",
  [SocketCloseCode.BAD_GATEWAY]:
    "Received an invalid response from an upstream server",
  [SocketCloseCode.TLS_HANDSHAKE_FAIL]: "The TLS handshake failed",
} as const;

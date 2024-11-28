import { SocketCloseCode } from "./socket-close-code";

export const SocketCloseReason = {
  [SocketCloseCode.NORMAL_CLOSURE]: "Connection closed cleanly.",
  [SocketCloseCode.GOING_AWAY]: "Endpoint going away.",
  [SocketCloseCode.PROTOCOL_ERROR]: "Protocol error.",
  [SocketCloseCode.UNSUPPORTED_DATA]: "Unsupported data type.",
  [SocketCloseCode.NO_STATUS_RECEIVED]: "No status code provided.",
  [SocketCloseCode.ABNORMAL_CLOSURE]: "Abnormal closure.",
  [SocketCloseCode.INVALID_PAYLOAD_DATA]: "Invalid payload data.",
  [SocketCloseCode.POLICY_VIOLATION]: "Policy violation.",
  [SocketCloseCode.MESSAGE_TOO_BIG]: "Message too big.",
  [SocketCloseCode.MANDATORY_EXTENSION]: "Mandatory extension missing.",
  [SocketCloseCode.INTERNAL_SERVER_ERROR]: "Internal server error.",
  [SocketCloseCode.SERVICE_RESTART]: "Server restarting.",
  [SocketCloseCode.TRY_AGAIN_LATER]: "Server overloaded, try later.",
  [SocketCloseCode.BAD_GATEWAY]: "Bad gateway response.",
  [SocketCloseCode.TLS_HANDSHAKE_FAIL]: "TLS handshake failure.",
} as const;

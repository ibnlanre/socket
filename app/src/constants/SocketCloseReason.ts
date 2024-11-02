import { SocketCloseCode } from "./SocketCloseCode";

export const SocketCloseReason = {
  [SocketCloseCode.NORMAL_CLOSURE]: "The connection has been closed cleanly.",
  [SocketCloseCode.GOING_AWAY]: "The endpoint is going away.",
  [SocketCloseCode.PROTOCOL_ERROR]:
    "The endpoint is terminating the connection due to a protocol error.",
  [SocketCloseCode.UNSUPPORTED_DATA]:
    "The connection is being terminated because the endpoint received data of a type it cannot accept.",
  [SocketCloseCode.NO_STATUS_RECVD]:
    "Indicates that no status code was provided even though one was expected.",
  [SocketCloseCode.ABNORMAL_CLOSURE]:
    "Indicates that the connection was closed abnormally, e.g., without sending or receiving a Close control frame.",
  [SocketCloseCode.INVALID_FRAME_PAYLOAD_DATA]:
    "Indicates that an endpoint is terminating the connection because it has received a message that is too big for it to process.",
  [SocketCloseCode.POLICY_VIOLATION]:
    "Indicates that an endpoint is terminating the connection because it has received a message that violates its policy.",
  [SocketCloseCode.MESSAGE_TOO_BIG]:
    "Indicates that an endpoint is terminating the connection because it has received a message that is too big.",
  [SocketCloseCode.MISSING_EXTENSION]:
    "Designated for use in applications expecting a status code to indicate that the connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).",
  [SocketCloseCode.INTERNAL_ERROR]:
    "Indicates that an internal server error has occurred.",
  [SocketCloseCode.SERVICE_RESTART]: "Indicates that the server is restarting.",
  [SocketCloseCode.TRY_AGAIN_LATER]:
    "Indicates that the server is overloaded and the client should try again later.",
  [SocketCloseCode.BAD_GATEWAY]:
    "Indicates that a gateway or proxy server received an invalid response from an inbound server.",
  [SocketCloseCode.TLS_HANDSHAKE]:
    "Indicates that a connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).",
} as const;

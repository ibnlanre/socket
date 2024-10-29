import { WebSocketCloseCode } from "./web-socket-close-code";

export const WebSocketCloseReason = {
  [WebSocketCloseCode.NORMAL_CLOSURE]:
    "The connection has been closed cleanly.",
  [WebSocketCloseCode.GOING_AWAY]: "The endpoint is going away.",
  [WebSocketCloseCode.PROTOCOL_ERROR]:
    "The endpoint is terminating the connection due to a protocol error.",
  [WebSocketCloseCode.UNSUPPORTED_DATA]:
    "The connection is being terminated because the endpoint received data of a type it cannot accept.",
  [WebSocketCloseCode.NO_STATUS_RECVD]:
    "Indicates that no status code was provided even though one was expected.",
  [WebSocketCloseCode.ABNORMAL_CLOSURE]:
    "Indicates that the connection was closed abnormally, e.g., without sending or receiving a Close control frame.",
  [WebSocketCloseCode.INVALID_FRAME_PAYLOAD_DATA]:
    "Indicates that an endpoint is terminating the connection because it has received a message that is too big for it to process.",
  [WebSocketCloseCode.POLICY_VIOLATION]:
    "Indicates that an endpoint is terminating the connection because it has received a message that violates its policy.",
  [WebSocketCloseCode.MESSAGE_TOO_BIG]:
    "Indicates that an endpoint is terminating the connection because it has received a message that is too big.",
  [WebSocketCloseCode.MISSING_EXTENSION]:
    "Designated for use in applications expecting a status code to indicate that the connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).",
  [WebSocketCloseCode.INTERNAL_ERROR]:
    "Indicates that an internal server error has occurred.",
  [WebSocketCloseCode.SERVICE_RESTART]:
    "Indicates that the server is restarting.",
  [WebSocketCloseCode.TRY_AGAIN_LATER]:
    "Indicates that the server is overloaded and the client should try again later.",
  [WebSocketCloseCode.BAD_GATEWAY]:
    "Indicates that a gateway or proxy server received an invalid response from an inbound server.",
  [WebSocketCloseCode.TLS_HANDSHAKE]:
    "Indicates that a connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).",
} as const;

export enum SocketCloseCode {
  /**
   * Indicates that the connection was closed normally (the connection successfully completed whatever purpose for which it was created).
   * If this code is used, and the initiator of the connection is not in the process of closing the connection, then this is an error.
   */
  NORMAL_CLOSURE = 1000,

  /**
   * Indicates that an endpoint is "going away", such as a server going down or a browser having navigated away from a page.
   * Alternatively, that an endpoint is terminating the connection due to a protocol error.
   */
  GOING_AWAY = 1001,
  ENDPOINT_UNAVAILABLE = 1001,

  /**
   * Indicates that an endpoint is terminating the connection because it has received a type of data it cannot accept
   * (e.g., an endpoint that understands only text data may send this if it receives a binary message).
   */
  PROTOCOL_ERROR = 1002,

  /**
   * Indicates that an endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message
   * (e.g., non-UTF-8 [RFC3629] data within a text message).
   *
   * If an endpoint is going to close a connection with a status code 1003, then it /SHOULD/ send a Close frame that consists of an empty message body.
   */
  UNSUPPORTED_DATA = 1003,
  INVALID_MESSAGE_TYPE = 1003,

  /**
   * This code is reserved and must not be set as a status code in a Close control frame by an endpoint.
   */
  RESERVED = 1004,

  /**
   * Indicates that no status code was provided even though one was expected.
   */
  NO_STATUS_RECEIVED = 1005,
  EMPTY = 1005,

  /**
   * Indicates that the connection was closed abnormally (that is, with no close frame being sent).
   */
  ABNORMAL_CLOSURE = 1006,

  /**
   * Indicates that an endpoint is terminating the connection because it has received a message that is too big for it to process.
   */
  INVALID_PAYLOAD_DATA = 1007,

  /**
   * Indicates that an endpoint is terminating the connection because it has received a message that violates its policy.
   * This is a generic status code that can be returned when there is no other more suitable status code (e.g., 1003 or 1009) or if there is a need to hide specific details about the policy.
   */
  POLICY_VIOLATION = 1008,

  /**
   * Indicates that an endpoint is terminating the connection because it has received a message that is too big.
   */
  MESSAGE_TOO_BIG = 1009,

  /**
   * Indicates that an endpoint (client) is terminating the connection because it expected the server to negotiate one or more extensions,
   * but the server didn't return them in the response message of the WebSocket handshake.
   *
   * The list of extensions that are needed SHOULD appear in the /reason/ part of the Close frame.
   * Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
   */
  MANDATORY_EXTENSION = 1010,

  /**
   * Indicates that an internal server error has occurred.
   */
  INTERNAL_SERVER_ERROR = 1011,

  /**
   * Indicates that the server is restarting.
   */
  SERVICE_RESTART = 1012,

  /**
   * Indicates that the server is overloaded and the client should either connect to a different IP (when multiple targets exist),
   * or reconnect to the same IP when a user has performed an action.
   */
  TRY_AGAIN_LATER = 1013,

  /**
   * Indicates that a gateway or proxy server received an invalid response from an inbound server
   */
  BAD_GATEWAY = 1014,

  /**
   * Indicates that a connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).
   */
  TLS_HANDSHAKE_FAIL = 1015,
}

export type SocketCode = SocketCloseCode | (number & {});

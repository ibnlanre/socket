import type { SocketCacheOptions } from "./cache-options";
import type { SocketDataHandlingOptions } from "./data-handling-options";
import type { SocketLoggingOptions } from "./logging-options";
import type { SocketProtocolIdentifier } from "./protocol-identifier";
import type { SocketReconnectOptions } from "./reconnect-options";
import type { SocketSchema } from "./schema";

export interface SocketConstructor<Get = unknown, Post = never, Params = never>
  extends
    SocketDataHandlingOptions<Get>,
    SocketCacheOptions,
    SocketLoggingOptions,
    SocketReconnectOptions {
  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;

  /**
   * The URL to connect to
   */
  url: string;

  /**
   * Validates and optionally transforms incoming websocket messages.
   */
  messageSchema?: SocketSchema<Get>;

  /**
   * Validates and optionally transforms URL params used for the connection.
   */
  paramsSchema?: SocketSchema<Params>;

  /**
   * Validates and optionally transforms outbound messages before send.
   */
  sendSchema?: SocketSchema<Post>;

  /**
   * The protocols to use for the WebSocket connection
   *
   * @description If an array is provided, the first protocol that the server supports will be used
   * @see https://www.iana.org/assignments/websocket/websocket.xml#subprotocol-name
   *
   * @default []
   */
  protocols?: SocketProtocolIdentifier | SocketProtocolIdentifier[];
}

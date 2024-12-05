import type { SocketCacheOptions } from "./socket-cache-options";
import type { SocketDataHandlingOptions } from "./socket-data-handling-options";
import type { SocketLoggingOptions } from "./socket-logging-options";
import type { SocketProtocolIdentifier } from "./socket-protocol-identifier";
import type { SocketReconnectOptions } from "./socket-reconnect-options";

export interface SocketConstructor<Get = unknown, Post = never>
  extends SocketDataHandlingOptions<Get, Post>,
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
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

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

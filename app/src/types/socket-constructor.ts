import type { SocketCacheOptions } from "./socket-cache-options";
import type { SocketEncryptionOptions } from "./socket-encryption-options";
import type { SocketLoggingOptions } from "./socket-logging-options";
import type { SocketPlaceholderOptions } from "./socket-placeholder-options";
import type { SocketProtocolIdentifier } from "./socket-protocol-identifier";
import type { SocketReconnectOptions } from "./socket-reconnect-options";
import type { SocketSetStateAction } from "./socket-set-state-action";

export interface SocketConstructor<Get = unknown, Post = never>
  extends SocketEncryptionOptions<Get, Post>,
    SocketPlaceholderOptions<Get, Post>,
    SocketCacheOptions,
    SocketReconnectOptions,
    SocketLoggingOptions {
  /**
   * The URL to connect to
   */
  url: string;

  /**
   * The base URL to use for the WebSocket connection
   *
   * @default ""
   */
  baseURL?: string;

  /**
   * The protocols to use for the WebSocket connection
   *
   * @description If an array is provided, the first protocol that the server supports will be used
   * @see https://www.iana.org/assignments/websocket/websocket.xml#subprotocol-name
   *
   * @default []
   */
  protocols?: SocketProtocolIdentifier | SocketProtocolIdentifier[];

  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * The reducer to construct the next state of the WebSocket connection
   *
   * @description The default reducer is the identity function
   */
  setStateAction?: SocketSetStateAction<Get>;
}

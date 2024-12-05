import type { SocketCipher } from "./socket-cipher";
import type { SocketSetStateAction } from "./socket-set-state-action";

export interface SocketDataHandlingOptions<Get = unknown, Post = never> {
  /**
   * A function to decrypt the received data.
   */
  decrypt?: SocketCipher;

  /**
   * Whether to decrypt the received data or not.
   *
   * @default false
   */
  decryptData?: boolean;

  /**
   * A function to encrypt the available data.
   */
  encrypt?: SocketCipher;

  /**
   * Whether to encrypt the payload or not.
   *
   * @default false
   */
  encryptPayload?: boolean;

  /**
   * The data to send to the WebSocket server on connection
   */
  initialPayload?: Post;

  /**
   * The initial state of the WebSocket connection
   */
  placeholderData?: Get;

  /**
   * The reducer to construct the next state.
   *
   * @description The default reducer is the identity function
   */
  setStateAction?: SocketSetStateAction<Get>;
}

import type { SocketCipher } from "./cipher";
import type { SocketSetStateAction } from "./set-state-action";

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
   * Seeds the socket with its initial value before live data arrives.
   */
  placeholderData?: Get;

  /**
   * The reducer to construct the next state.
   *
   * @description The default reducer is the identity function
   */
  setStateAction?: SocketSetStateAction<Get>;
}

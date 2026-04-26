import type { UnitValue } from "@/types/time-unit";
import type { SocketCipher } from "./cipher";
import type { SocketSetStateAction } from "./set-state-action";

export interface SocketDataHandlingOptions<Get = unknown> {
  /**
   * Collapse identical outbound payloads sent within this window into a single
   * wire message. Callers sharing the same socket instance will all observe the
   * shared response without each triggering a separate server round-trip.
   *
   * Set to `0` or omit to disable deduplication.
   *
   * @default 0
   */
  deduplicationWindow?: UnitValue;

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

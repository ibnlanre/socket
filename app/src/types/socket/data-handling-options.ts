import type { UnitValue } from "@/types/time-unit";
import type { SocketCipher } from "./cipher";
import type { SocketSetStateAction } from "./set-state-action";

export type SocketMessageFailureAction = "recover" | "close";

export interface SocketMessageFailurePolicy {
  /**
   * How to handle failures while decoding the raw WebSocket payload.
   * This covers unsupported payload types and binary-to-text decoding failures.
   *
   * @default "close"
   */
  decode?: SocketMessageFailureAction;

  /**
   * How to handle failures while parsing an incoming message into JSON.
   *
   * @default "recover"
   */
  parse?: SocketMessageFailureAction;

  /**
   * How to handle failures while validating a parsed message against `messageSchema`.
   *
   * @default "recover"
   */
  validation?: SocketMessageFailureAction;
}

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
   * Controls whether inbound message failures only update local error state or
   * also terminate the current socket.
   */
  messageFailurePolicy?: SocketMessageFailurePolicy;

  /**
   * The reducer to construct the next state.
   *
   * @description The default reducer is the identity function
   */
  setStateAction?: SocketSetStateAction<Get>;
}

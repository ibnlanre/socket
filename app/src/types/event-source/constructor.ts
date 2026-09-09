import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ReconnectionPolicy } from "../reconnection-policy";
import type { Init } from "./init";

export interface EventSourceClientOptions<Data = unknown>
  extends Init, ReconnectionPolicy {
  /**
   * The URL to connect to
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource
   */
  url: string;

  /** Maximum queued native events awaiting validation. @default 1000 */
  maxPendingMessages?: number;

  /**
   * The base URL to use for the Server-Sent Events connection
   *
   * @description The base URL is used to resolve relative URLs in the `EventSource` constructor
   * @default ""
   */
  baseURL?: string;

  /**
   * A Standard Schema to validate parsed JSON message data before dispatching.
   *
   * When provided, the raw SSE data buffer is JSON-parsed and validated
   * against this schema. Only valid messages are dispatched to listeners.
   * Invalid messages are silently dropped.
   */
  messageSchema?: StandardSchemaV1<unknown, Data>;
}

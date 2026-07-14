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

  /**
   * The base URL to use for the Server-Sent Events connection
   *
   * @description The base URL is used to resolve relative URLs in the `EventSource` constructor
   * @default ""
   */
  baseURL?: string;

  /**
   * Whether to enable the WebSocket connection or not
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * A Standard Schema to validate parsed JSON message data before dispatching.
   *
   * When provided, the raw SSE data buffer is JSON-parsed and validated
   * against this schema. Only valid messages are dispatched to listeners.
   * Invalid messages are silently dropped.
   */
  messageSchema?: StandardSchemaV1<Data>;
}

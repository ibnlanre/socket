import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ReconnectionPolicy } from "../reconnection-policy";
import type { RuntimeAdapters } from "../runtime";
import type { Init } from "./init";
import type { EventSourceTransportMode } from "./transport";

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
   * How to select the Server-Sent Events transport.
   *
   * Native `EventSource` can only issue GET requests and cannot set request
   * headers, a body, an initial `Last-Event-ID`, or most `RequestInit` options.
   * Under `"auto"` those configurations use fetch streaming instead, so the
   * library never silently discards configuration a transport cannot honor.
   *
   * Named `transport` because `RequestInit.mode` already exists and remains
   * available for fetch requests.
   *
   * @default "auto"
   */
  transport?: EventSourceTransportMode;

  /**
   * Environment implementations to use instead of ambient globals.
   *
   * Injected adapters win over globals and are resolved when the connection
   * opens, so importing or constructing the client never depends on the
   * runtime providing `EventSource` or `fetch`.
   */
  runtime?: RuntimeAdapters;

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

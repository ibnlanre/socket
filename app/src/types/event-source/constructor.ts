import type { ReconnectionPolicy } from "../reconnection-policy";
import type { Init } from "./init";

export interface EventSourceClientOptions extends Init, ReconnectionPolicy {
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
}

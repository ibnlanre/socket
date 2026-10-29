/**
 * Environment implementations the library depends on.
 *
 * Injected adapters take precedence over ambient globals. Globals are resolved
 * lazily when an operation needs them — never at module import or construction
 * time — so a missing implementation surfaces as an actionable error at the
 * point of use.
 */
export interface RuntimeAdapters {
  /** Cache Storage implementation. Falls back to the ambient `caches` global. */
  caches?: CacheStorage;

  /** EventSource constructor. Falls back to the ambient `EventSource` global. */
  eventSource?: typeof EventSource;

  /** Fetch implementation. Falls back to the ambient `fetch` global. */
  fetch?: typeof fetch;

  /** WebSocket constructor. Falls back to the ambient `WebSocket` global. */
  webSocket?: WebSocketConstructor;
}

/**
 * A `WebSocket` constructor usable for the managed connection.
 *
 * Third-party implementations (`ws`, React Native, workers) are structurally
 * compatible with the browser API in practice; cast at the call site when the
 * ambient `WebSocket` type is stricter than the implementation.
 */
export type WebSocketConstructor = new (
  url: string,
  protocols?: string | string[]
) => WebSocket;

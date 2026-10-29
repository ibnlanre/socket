/** The concrete transport selected for a connection. */
export type EventSourceTransport = "fetch" | "native";

/**
 * How the client selects its Server-Sent Events transport.
 *
 * - `"auto"` prefers native `EventSource` when the request *and* the requested
 *   behavior are fully expressible by it, otherwise streams through `fetch`.
 * - `"native"` requires native `EventSource`; incompatible configuration is an
 *   error rather than a silent downgrade.
 * - `"fetch"` always streams through `fetch`.
 */
export type EventSourceTransportMode = "auto" | "fetch" | "native";

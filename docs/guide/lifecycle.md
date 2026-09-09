# Lifecycle & status

The library exposes two complementary status dimensions on a socket, plus a set of derived boolean flags for ergonomic rendering.

## `status` — the high-level lifecycle

```ts
type SocketStatus = "idle" | "stale" | "loading" | "success" | "error";
```

| Status | Meaning |
| --- | --- |
| `idle` | Never opened, or torn down. |
| `loading` | No value yet; the first payload is pending. |
| `success` | The latest message was parsed and stored. |
| `error` | A connection or message error occurred. |
| `stale` | Has a (cached) value but the transport isn't delivering — e.g. reconnecting. |

## `fetchStatus` — the low-level connection phase

```ts
type SocketFetchStatus = "idle" | "connecting" | "connected" | "disconnected";
```

| Status | Meaning |
| --- | --- |
| `idle` | Not attempting to connect. |
| `connecting` | Dialing / waiting to open. |
| `connected` | The WebSocket is open. |
| `disconnected` | The connection dropped (e.g. scheduling a retry). |

## Derived flags

The state object exposes derived getters so you rarely compare statuses yourself:

**State flags**
- `isIdle`, `isLoading`, `isSuccess`, `isError`
- `isPending` — `isPlaceholderData || value === undefined`
- `isStaleData` — `status === "stale"` (cached value, stale transport)
- `isRefetching` — `isLoading && failureCount > 0`
- `isRefetchError` — `isError && failureCount > 0`

**Connection flags**
- `isIdle`, `isConnecting`, `isConnected`, `isDisconnected` — mirror `fetchStatus`.

**Metadata**
- `failureCount`, `failureReason`, `error`
- `dataUpdatedAt`, `errorUpdatedAt`
- `isPlaceholderData`

## Rendering state

```tsx
const socket = client.useSocket();

return (
  <div>
    {socket.isConnecting && <Spinner />}
    {socket.isConnected && <StatusDot online />}

    {socket.isLoading && <p>Connecting…</p>}
    {socket.isSuccess && <p>{socket.data}</p>}
    {socket.isError && <p role="alert">Something went wrong.</p>}

    {/* keep showing cached data while reconnecting */}
    {socket.isStaleData && <p className="muted">{socket.data}</p>}
  </div>
);
```

## A typical timeline

```
open()  → fetchStatus "connecting"   (hydrating cache + dialing)
open    → fetchStatus "connected"
message → status "success"           (cache-first: stale → success)
drop    → fetchStatus "disconnected" (retry scheduled; status may be "stale")
reopen  → fetchStatus "connected", status back to "success"
close() → fetchStatus "idle"
```

## EventSource status

`EventSourceClient` has its own narrower lifecycle:

```ts
type EventSourceStatus = "idle" | "connecting" | "open" | "error";
```

Message-level errors set `status: "error"` (plus `error`); the next successfully delivered event restores `"open"`. It also exposes `lastEventId`, `dataBuffer`, and `eventTypeBuffer` for advanced use.

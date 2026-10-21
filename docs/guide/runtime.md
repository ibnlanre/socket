# Runtime support

`@ibnlanre/socket` needs a few things from its environment: a WebSocket implementation, and — depending on what you use — an SSE transport and Cache Storage.

None of them are read at import or construction time. Each is resolved when an operation actually needs it, and each can be supplied explicitly through the `runtime` option.

## Support matrix

| Capability | Node 18 / 20 | Node 22+ | Browser |
| --- | --- | --- | --- |
| Import and construct | ✅ | ✅ | ✅ |
| `Socket` connect | ❌ needs `runtime.webSocket` | ✅ ambient `WebSocket` | ✅ |
| `EventSourceClient`, default `transport` | ✅ fetch | ✅ fetch | ✅ native |
| `transport: "native"` | ❌ | ❌ | ✅ |
| `transport: "fetch"` | ✅ | ✅ | ✅ |
| Cache Storage backend | ❌ | ❌ | ✅ |
| In-memory backend (`cacheFallback: "memory"`) | ✅ | ✅ | ✅ |

Node publishes no `EventSource` global at any version, including 24 — it is only available behind `--experimental-eventsource`, which is why fetch streaming is the portable SSE path. No Node release ships the Cache API either, which is why the default cache backend outside browsers is `"none"`.

A ❌ means the operation fails with an actionable error naming the option to pass; it does not throw a bare `ReferenceError`.

## `runtime` adapters

Injected adapters win over ambient globals. Globals are only consulted when an operation needs them, so a runtime without a transport fails on `open()` rather than on import.

```ts
import WsWebSocket from "ws";
import type { WebSocketConstructor } from "@ibnlanre/socket";

const client = new SocketClient({
  baseURL: "wss://example.com",
  url: "/chat",
  runtime: {
    webSocket: WsWebSocket as unknown as WebSocketConstructor,
  },
});
```

The same object is accepted by `EventSourceClient`:

```ts
const events = new EventSourceClient({
  url: "/events",
  transport: "fetch",
  runtime: { fetch: customFetch },
});
```

| Adapter | Used by | Falls back to |
| --- | --- | --- |
| `runtime.webSocket` | `Socket`, `SocketClient` | ambient `WebSocket` |
| `runtime.eventSource` | `EventSourceClient` (`"native"`) | ambient `EventSource` |
| `runtime.fetch` | `EventSourceClient` (`"fetch"`) | ambient `fetch` |
| `runtime.caches` | `SocketCache` | ambient `caches` |

## SSE transports

`EventSourceClient` selects a transport from the `transport` option:

### `"auto"` (default)

Native `EventSource` is used only when it can honor the **whole** configuration. It cannot express:

- any method other than `GET`
- custom request headers
- a request body
- an initial `Last-Event-ID`
- `credentials: "omit"` or most `RequestInit` options (`mode`, `redirect`, `referrer`, `referrerPolicy`, `integrity`, `keepalive`, `window`)

If any of those are present, `auto` streams through fetch instead, so configuration is never silently discarded. Otherwise fetch is used when native is unavailable.

### `"native"` and `"fetch"`

Explicit modes never downgrade silently. `"native"` raises an error describing the option it cannot honor; `"fetch"` raises an error when no `fetch` implementation exists.

### Observing the choice

`client.transport` reports `"native"` or `"fetch"` for the current connection and resets to `null` on `close()`.

## Cache backends

`SocketCache` uses Cache Storage when it exists. Otherwise `cacheFallback` decides:

| `cacheFallback` | Cache Storage present | Cache Storage absent |
| --- | --- | --- |
| `"none"` (default) | `persistence: "cache-storage"` | `persistence: "none"` |
| `"memory"` | `persistence: "cache-storage"` | `persistence: "memory"` |

`persistence` is set by `initialize()` and reports the backend that is actually live. An in-memory cache lives and dies with the instance: it is not shared between instances and does not survive a reload, so it is not a substitute for Cache Storage.

`SocketCache.isAvailable` is deprecated in favour of `persistence`, because it only inspects the ambient global and cannot describe an injected adapter.

## Testing

In a test runner without browser globals — including Vitest's `node` environment — inject the adapter you want rather than stubbing globals:

```ts
const fetched = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
const client = new EventSourceClient({
  url: "/events",
  runtime: { fetch: fetched },
});
```

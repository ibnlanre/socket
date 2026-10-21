# Server-Sent Events

When you need a simple **one-way** stream rather than a bidirectional socket, `@ibnlanre/socket` ships `EventSourceClient`. It supports two transports, selected by the `transport` option rather than by the HTTP method:

- **`"native"`** — the browser's built-in `EventSource`.
- **`"fetch"`** — fetch-based streaming with a manual SSE framing parser. Works with any method and any request headers.

`transport: "auto"` (the default) uses native only when the request and the requested behavior are fully expressible by it — GET, no custom headers, no body, no initial `Last-Event-ID` — and otherwise streams through fetch. The selected transport is available as `client.transport`. See [Runtime support](/guide/runtime#sse-transports).

```ts
import { EventSourceClient } from "@ibnlanre/socket";

// Explicitly native
const client = new EventSourceClient({
  url: "/events",
  transport: "native",
});

client.open();
```

## Basic usage

```ts
const client = new EventSourceClient({
  url: "/stream",
  method: "POST",
  body: JSON.stringify({ topics: ["prices"] }),
  headers: { "Content-Type": "application/json" },
  retry: true,
});

client.open();

const off = client.on("message", (event) => {
  console.log("data", event.data); // validated Data when messageSchema is set
});

// later…
off();
client.close();
```

## Named events

SSE `event:` fields are dispatched to matching listeners; the default type is `"message"`.

```ts
client.on("update", (event) => console.log("update", event.data));
client.on("ping", (event) => console.log("keep-alive"));
```

## Async iteration

`EventSourceClient` is an async iterable yielding `"message"` events:

```ts
for await (const event of client) {
  console.log(event.data);
}
```

Each iteration awaits the next `"message"` event, so a `for await` loop consumes the stream sequentially.

## Transport differences to know

| Concern | GET (native `EventSource`) | non-GET (fetch) |
| --- | --- | --- |
| `headers` | ❌ ignored | ✅ sent |
| `cache` / `body` / other `RequestInit` | ❌ ignored | ✅ sent |
| `credentials: "include"` | ✅ honored (`withCredentials`) | ✅ sent |
| Named events | ✅ via native forwarders | ✅ |
| `retry:` server field | — | ✅ overrides `retryDelay` |
| `Last-Event-ID` | native handling | ✅ sent when available |

::: warning GET ignores most RequestInit
On the **native EventSource (GET)** path, only `credentials: "include"` is honored (mapped to `withCredentials`). Headers, cache mode, body, and other `RequestInit` fields are **ignored** — use a non-GET method (fetch streaming) when you need headers.
:::

## Validation

Like sockets, the client accepts a `messageSchema` (Standard Schema, async supported). The raw SSE data buffer is `JSON.parse`d and validated; valid messages dispatch the validated `Data`, invalid ones are dropped after invoking the error handler.

## Status & errors

- `status` is one of `"idle" | "connecting" | "open" | "error"`.
- Message-level errors set `status: "error"` and dispatch an `"error"` event; the next delivered event restores `"open"`.
- With `retry: true`, failures reconnect with backoff (fixed by default) up to `retryCount`.

## Reference

Full API details: [Reference → EventSourceClient](/api/event-source-client).

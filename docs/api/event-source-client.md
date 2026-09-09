# `EventSourceClient`

A one-way Server-Sent Events client with two transports, selected by the request `method`: **native `EventSource`** for GET, and **fetch-based streaming** for any other method.

```ts
class EventSourceClient<Data = unknown, Params extends ConnectionParams = never> {
  constructor(options: EventSourceClientOptions<Data>, params?: Params);
}
```

## Type parameters

| Param | Meaning |
| --- | --- |
| `Data` | The (optionally validated) event data type. Default `unknown`. |
| `Params` | The params object type. Default `never`. |

## Options

`EventSourceClientOptions<Data>` extends `Init` (a `RequestInit` with `headers?: HeadersInit`, `method?: MethodInit`, `initialLastEventId?: string | null`) plus `ReconnectionPolicy`, and adds:

| Option | Default | Description |
| --- | --- | --- |
| `url` | — (required) | Endpoint to connect to |
| `baseURL` | `""` | Base URL prepended to `url` |
| `messageSchema` | — | Standard Schema for event data (async supported) |
| `initialLastEventId` | `null` | `Last-Event-ID` to send on first connect |
| `method` | `"GET"` | HTTP verb; anything but GET uses fetch streaming |
| `cache` | `"no-store"` | `RequestInit.cache` (fetch path) |
| `retry` / `retryDelay` / `retryCount` / `retryBackoffStrategy` | `false` / `"5 seconds"` / `3` / `"fixed"` | see [Reconnection](/guide/reconnection) |

## Methods

### `open()`

Connects using the transport implied by `method`. Builds the resolved URL, applies headers/credentials as applicable, and starts the stream.

```ts
open(): void;
```

### `close()`

Closes the stream and tears down listeners + native forwarders (one-shot lifecycle).

```ts
close(): void;
```

### `on(type, listener)`

Subscribes to events of `type` (named SSE events or the default `"message"`). Returns an unsubscribe function; keyed by handler reference.

```ts
on<Name extends string>(type: Name, listener: EventSourceListener<Data>): () => void;
// EventSourceListener<Data> = (event: MessageEvent<Data>) => void
```

### Async iteration

Yields `"message"` events only.

```ts
async *[Symbol.asyncIterator](): AsyncGenerator<MessageEvent<Data>>;
```

## Fields

| Field | Initial | Description |
| --- | --- | --- |
| `error` | `null` | Last error (also dispatched to `"error"` listeners) |
| `status` | `"idle"` | `"idle" \| "connecting" \| "open" \| "error"` |
| `dataBuffer` | `""` | SSE field staging buffer (public) |
| `lastEventId` | `""` | Last received event id |
| `eventTypeBuffer` | `""` | Last `event:` field |

## Example

```ts
import { EventSourceClient } from "@ibnlanre/socket";

const client = new EventSourceClient({
  url: "/api/stream",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topics: ["prices"] }),
  retry: true,
});

client.open();

const off = client.on("update", (event) => {
  console.log("update", event.data);
});

for await (const event of client) {
  console.log("message", event.data);
  break; // consume one message
}

off();
client.close();
```

Transport gotchas and behavior details: [Guide → Server-Sent Events](/guide/event-source).

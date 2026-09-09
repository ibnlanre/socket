# Sending messages

`socket.send(payload)` is the imperative way to push a JSON payload over the connection. It returns a boolean indicating whether the payload was dispatched.

## Signatures

```ts
// SocketClient hook commands are bound to the pooled socket:
const { send } = client.useSocket({ params });

// Imperative:
const socket = client.get(params);
const ok = socket.send({ type: "message", content: "hi" });
```

`send` is typed by the `Post` generic (and validated by `sendSchema` when configured — see [Validation](/guide/validation)).

## Return value

| Return | Meaning |
| --- | --- |
| `true` | The payload was dispatched now, or queued to flush on open. |
| `false` | The payload was **deduplicated** (suppressed). |

## Queueing before open

When the socket isn't open yet, `send` **queues** the payload and flushes queued messages in order once the connection opens. So you can `send` immediately after constructing a socket without waiting for `open`:

```ts
socket.open();
socket.send({ type: "message", content: "queued until open" }); // returns true
await socket.waitUntil("open"); // queue flushes here, in order
```

## Deduplication

With `deduplicationWindow` set, identical outbound payloads (same serialized params key) within the window collapse into **one** wire message.

```tsx
const client = new SocketClient({
  url: "/prices",
  deduplicationWindow: "500 ms",
});

// Two components sending the same payload within 500ms…
socket.send({ type: "subscribe", symbol: "BTC" }); // true — dispatched
socket.send({ type: "subscribe", symbol: "BTC" }); // false — suppressed
```

All callers still observe the shared response — deduplication only removes redundant **outbound** frames. This is handy when multiple components subscribe to the same thing on one pooled socket.

## `waitUntil`

`waitUntil` resolves when the socket reaches a given connection event, with an optional timeout:

```ts
await socket.waitUntil("open");              // default timeout: 5 seconds
await socket.waitUntil("message", "30 s");   // custom timeout
await socket.waitUntil("close");
```

`SocketConnectionEvent` is `"open" | "message" | "close" | "error"`.

## Tearing down

`socket.close()` performs a clean teardown: sends a normal close (`1000`), clears caches if `clearCacheOnClose` is set, removes window listeners, and clears both transport listeners and state subscribers. It uses `SocketCloseReason` as the close reason string.

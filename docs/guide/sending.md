# Sending messages

`socket.send(payload)` is the imperative way to push a JSON payload over the connection. It returns a boolean indicating whether the payload was accepted for dispatch or queuing.

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

With `deduplicationWindow` set, identical outbound payloads (same canonical JSON value) within the window collapse into **one** wire message.

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

## Async sends

When your `sendSchema` is asynchronous, use `sendAsync` instead of `send`:

```ts
const accepted = await socket.sendAsync({ type: "subscribe", symbol: "BTC" }); // true | false
```

`sendAsync` validates, then accepts the payload into the same ordered queue. It rejects on validation failure, or cancellation/expiry/overflow while validation is pending. Once accepted, expiry or dropping is reported through diagnostics; an already-resolved Promise cannot report later delivery failure.

## `waitUntil`

`waitUntil` resolves when the socket reaches a given connection event, with an optional timeout:

```ts
await socket.waitUntil("open");              // default timeout: 5 seconds
await socket.waitUntil("message", "30 s");   // custom timeout
await socket.waitUntil("close");
```

`SocketConnectionEvent` is `"open" | "message" | "close" | "error"`.

## Tearing down

`socket.close()` disconnects and clears caches if `clearCacheOnClose` is set. Subscriptions and event listeners are **preserved**, so a later `open()` reconnects the same consumers. It uses `SocketCloseReason` as the close reason string.

To permanently release a socket (clearing its listeners and subscriptions), use `client.close(params)` / `client.evict(params)` or `socket.dispose()`.

Waiting sends are bounded by `maxQueueSize`, `queueMaxAge`, and `queueOverflow` — see [Reference → Options](/api/options).

## Queue guarantees

With deduplication disabled, repeated calls remain separate messages even while disconnected. When enabled, duplicate pending messages return `false`. JSON object-key order does not affect deduplication; array order does.

`sendAsync` reserves its place before validation. Later synchronous or asynchronous sends cannot overtake that place. Validation failure, cancellation, or expiry releases it. Closing clears waiting sends and cancels pending validation waits.

The default queue holds at most 1000 sends for one minute. Full queues reject by default; `queueOverflow: "drop-oldest"` opts into dropping. `true` means locally accepted, not received or acknowledged by the server. Observe `onDiagnostic` for later queue expiry/drop/transmission events.

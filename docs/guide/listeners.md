# Listeners

Both `Socket` and `EventSourceClient` expose an `on` API for listening to events. There are two distinct subscription mechanisms — know which one you're using.

## `Socket.on(...)` — raw transport events

`on` subscribes to events **on the WebSocket connection**. It returns an unsubscribe function.

```ts
socket.on("open", (event) => console.log("opened", event));
const offMessage = socket.on("message", (event) => {
  console.log("raw frame", event.data);
});
const offClose = socket.on("close", (event) => console.log("closed", event.code, event.reason));

// later…
offClose();
offMessage();
```

The event names mirror the DOM `WebSocket` events: `"open"`, `"message"`, `"close"`, `"error"`.

### Handler-reference keying

Listeners are stored in a `Map<event, Set<handler>>` **keyed by handler reference**. This has two important consequences:

- **Each distinct handler owns its own subscription.** Two components sharing one pooled socket should each pass their own handler; one unmounting never detaches the other.
- **Re-registering the same handler is a no-op** — it returns the shared unsubscribe instead of subscribing twice.

```ts
function handleMessage() {}

const off1 = socket.on("message", handleMessage);
const off2 = socket.on("message", handleMessage); // same handler → no second subscription

off1 === off2; // true
off1(); // removes the handler entirely
```

### Listeners survive reconnects

Automatic reconnects re-attach listeners, so you don't re-subscribe on every retry. An **explicit `socket.close()`** disconnects but preserves listeners and subscriptions — a later `open()` re-attaches them. Only a permanent release (`socket.dispose()`, or `client.close(params)` / `client.evict(params)` on a pooled socket) clears listeners and subscribers.

## `socket.subscribe(...)` — state observers

Separate from `on`, `subscribe` observes the **socket state object** rather than transport events. It's what `useSocket` uses internally.

```ts
const unsubscribe = socket.subscribe((client) => {
  console.log(client.status, client.fetchStatus, client.value);
}, true); // immediate? true → calls back synchronously on subscribe

// later…
unsubscribe();
```

When the **last** subscriber unsubscribes, an idle timer arms `close()` after `idleConnectionTimeout` (default 5 minutes) — connections shared by no one get cleaned up automatically.

## `EventSourceClient.on(...)` — named events

`EventSourceClient` dispatches `MessageEvent`s and lets you subscribe by event type, including **named** SSE events:

```ts
const client = new EventSourceClient({ url: "/stream", method: "POST" });
client.open();

const off = client.on("update", (event) => {
  console.log("update", event.data);
});
client.on("error", (event) => console.error("stream error", event.data));
```

Subscriptions are also keyed by handler reference: each distinct handler owns a subscription, and re-registering the same handler is a no-op.

### Named events on native EventSource (GET)

Native `EventSource` only delivers named events that were subscribed up front. When you call `client.on("custom", handler)`, the client registers a native forwarder for that event name (excluding `"message"`/`"error"`), attached on creation and re-attached on every reconnect.

### Async iteration

`EventSourceClient` is an async iterable that yields `"message"` events:

```ts
for await (const event of client) {
  console.log(event.data);
}
```

Iterators buffer events between reads (default capacity 1000). Use `client.events({ signal, maxQueueSize })` to configure cancellation/capacity. Closing settles pending reads; overflow rejects instead of silently dropping.

# `Socket`

A single managed JSON WebSocket connection. Implements `SocketState<Get>` and `SocketCommands<Post>` directly.

```ts
class Socket<Get = unknown, Post = never, Params extends ConnectionParams = never>
  implements SocketState<Get>, SocketCommands<Post>
{
  constructor(configuration: SocketConstructor<Get, Post, Params>, params?: Params);
}
```

You normally reach a `Socket` through [`SocketClient.get()`](/api/socket-client#get-params), which pools instances by URL. Constructing one directly is for standalone use.

## Commands

### `open()`

Opens the connection. No-op when already open/opening. Loads cached data **before** dialing (cache-first).

```ts
open(): void;
```

### `close()`

Disconnects the transport: sends a normal close (`1000`), clears caches if `clearCacheOnClose`, removes window listeners, and nulls the socket. **Subscriptions and event listeners are preserved**, so a later `open()` reconnects the same consumers. To permanently release an instance, use `dispose()`.

```ts
close(): void;
```

### `dispose()`

Permanent teardown for an instance that will not be reused. Disconnects (via `close()`), then clears transport listeners and state subscribers and marks the instance inactive — further calls throw.

```ts
dispose(): void;
```

### `send(payload)`

Validates synchronously (when `sendSchema` is set), then accepts a JSON payload into the ordered send queue. Returns `true` when dispatched or queued, `false` when deduplicated within `deduplicationWindow`. Queued payloads flush in order on `open`. See [Sending messages](/guide/sending).

```ts
send(payload: Post): boolean;
```

### `sendAsync(payload, options?)`

For asynchronous `sendSchema` validation. Validates, then accepts the payload into the same ordered queue. Resolves `true` on accept (a deduplicated send resolves `false`); rejects on validation failure, or cancellation/expiry/overflow while validation is still pending. Later queue expiry/drop is reported through diagnostics.

```ts
sendAsync(
  payload: Post,
  options?: { signal?: AbortSignal },
): Promise<boolean>;
```

### `on`

Subscribes to raw transport events; returns an unsubscribe function. Keyed by handler reference. See [Listeners](/guide/listeners).

```ts
on: SocketListener;

interface SocketListener {
  (event: "open",    callback: (ev: Event) => void): () => void;
  (event: "message", callback: (ev: MessageEvent) => void): () => void;
  (event: "close",   callback: (ev: CloseEvent) => void): () => void;
  (event: "error",   callback: (ev: Event) => void): () => void;
}
```

### `waitUntil(state, timeout?)`

Resolves when the socket reaches a connection event.

```ts
waitUntil(state: SocketConnectionEvent, timeout?: UnitValue): Promise<void>;
// SocketConnectionEvent = "open" | "message" | "close" | "error"
```

### `subscribe(listener, immediate?)`

Observes socket **state** (not transport events). `immediate` (default `true`) invokes the listener synchronously on subscribe.

```ts
subscribe(
  listener: (client: Socket<Get, Post, Params>) => void,
  immediate?: boolean,
): () => void;
```

The last subscriber unsubscribing arms `close()` after `idleConnectionTimeout` (default 5 minutes).

`getSnapshot()` returns the current immutable state snapshot (a frozen clone) backing `subscribe` and the React hooks via `useSyncExternalStore`; the reference is stable between state changes.

## State

### Instance fields

| Field | Type | Initial |
| --- | --- | --- |
| `binaryType` | `"blob" \| "arraybuffer"` | `"blob"` |
| `cache` | `SocketCache<Get>` | built in constructor |
| `dataUpdatedAt` | `number` | `0` |
| `error` | `Error \| null` | `null` |
| `errorTimeout` | `number` | `0` |
| `errorUpdatedAt` | `number` | `0` |
| `failureCount` | `number` | `0` |
| `failureReason` | `string \| null` | `null` |
| `fetchStatus` | `SocketFetchStatus` | `"idle"` |
| `isPlaceholderData` | `boolean` | `false` |
| `path` | `string` | pathname of the resolved href |
| `status` | `SocketStatus` | `"loading"` |
| `value` | `Get \| undefined` | `undefined` |
| `ws` | `WebSocket \| null` | `null` |

### State getters

`isIdle`, `isConnecting`, `isConnected`, `isDisconnected` — derived from `fetchStatus`.

`isLoading`, `isSuccess`, `isError`, `isPending`, `isRefetching`, `isRefetchError`, `isStaleData` — derived from `status`/`failureCount`/`value`.

See [Lifecycle & status](/guide/lifecycle) for semantics.

## Standalone example

```ts
import { Socket } from "@ibnlanre/socket";

const socket = new Socket({
  url: "wss://echo.example.com",
  placeholderData: { message: "connecting…" },
});

socket.open();
await socket.waitUntil("open");

socket.send({ event: "ping" });
await socket.waitUntil("message");

const unsubscribe = socket.on("message", (event) => console.log(event));

socket.close();
```

`waitUntil(state, timeout, { signal })` supports cancellation. Closing settles a pending close wait and rejects other pending waits with an `AbortError`.

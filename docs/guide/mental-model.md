# Mental model

Understanding a few core ideas makes the rest of the API feel obvious.

## One `SocketClient` = one endpoint

A `SocketClient` represents **one WebSocket endpoint**. You construct it once with the endpoint's `url` (and optionally a `baseURL`, schemas, and connection options), and reuse it everywhere that endpoint is needed.

```ts
const chatClient = new SocketClient<unknown, never, { room: string }>({
  baseURL: "wss://chat.example.com",
  url: "/ws",
});
```

## Same params reuse the same socket

Sockets are **pooled by their fully built URL** — the resolved `baseURL + url` plus the serialized `params`. Calling `client.get(params)` (or rendering `client.useSocket({ params })`) with identical params returns the **same underlying `Socket` instance**, so two components can share one live connection.

```ts
const a = await chatClient.get({ room: "general" });
const b = await chatClient.get({ room: "general" });

a === b; // true — one connection
```

Different params produce different managed sockets:

```ts
const lounge = await chatClient.get({ room: "lounge" });
lounge === a; // false — a separate connection
```

You can assert sharing at runtime by comparing command references:

```ts
a.send === b.send; // true when they share the same socket
```

## Hook for components, instance for imperative code

- `client.useSocket(...)` is the **React entrypoint**. It subscribes to a managed socket and returns a read-only state, selected data, and `send`.
- `await client.get(...)` gives you the **managed socket instance** for imperative actions such as `open`, `send`, and `waitUntil`.

## A layered API

```
SocketClient                 pool + React hook
   └─ Socket                 one managed connection (state + commands)
        └─ SocketCache       in-memory mirror + Cache API persistence
        └─ WebSocket         the raw browser transport
```

`Socket` implements two public contracts:

- `SocketState<Get>` — the read-only snapshot (`value`, `status`, `fetchStatus`, flags, timestamps, …).
- `SocketCommands<Post>` — the actions (`open`, `close`, `send`, `on`, `waitUntil`).

`useSocket` returns read-only `SocketState`, selected `data`, and a subscription-scoped `send`. Get the imperative socket for lifecycle controls and raw transport listeners.

## Cache-first by design

`open()` loads from the cache **before** dialing the socket. When a valid cached value exists, it renders immediately (`status: "stale"`, `isStaleData: true`) until the first live message flips it to `"success"`.

## Framework and runtime boundaries

`SocketClient` includes the React hook. `Socket`, `SocketCache`, and `EventSourceClient` do not import React directly, but that does not guarantee support in every JavaScript runtime. The socket lifecycle uses browser APIs such as `window` and `WebSocket`, and persistence uses the Cache API when available. The package also currently declares React and React DOM as peer dependencies.

Treat browser applications as the supported starting point. Other runtimes require checking their transport and lifecycle APIs rather than assuming that framework independence means runtime independence.

## Parameters describe a subscription

For a backend that chooses its stream from URL parameters, the parameters are the subscription: a room, instrument, filter, or report. Render the desired parameters and let the client find that stream’s socket.

Changing parameters selects another connection. It does not send an update frame to the existing connection. Returning to an existing serialized URL reuses its pooled socket. Use `send` for protocols that accept commands over an established connection.

Keep parameter values stable. A search field that changes on every keystroke can create many pooled sockets; debounce the committed subscription parameters when appropriate.

Object keys are sorted when building URL identity; array order is preserved. Normalized parameters determine which connection is shared.

## Shared connection, shared commands

A pooled `Socket` is shared, so its commands are shared too — compare `a.send === b.send` to confirm two handles point at one connection.

Ownership is explicit. Four operations mean four different things:

| Operation | Scope | Effect |
| --- | --- | --- |
| `socket.close()` | connection | Disconnects the transport. **Subscriptions and event listeners are preserved**, so a later `open()` reconnects the same consumers. |
| `socket.dispose()` | instance | Permanent teardown: disconnects, then clears listeners and subscribers. The instance can no longer be used. |
| `await client.evict(params)` | pool | Disposes that pooled socket and removes it from the pool. |
| hook unmount | subscription | Removes that one hook’s subscription. When the last subscriber leaves, the idle timeout closes an unused connection. |

- Calling `close()` on a shared socket disconnects it for every consumer. It is not a way to unsubscribe just one component.
- `enabled: false` skips that hook’s parameter resolution and subscription. It does not close a connection another consumer already opened.

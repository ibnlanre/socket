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
const a = chatClient.get({ room: "general" });
const b = chatClient.get({ room: "general" });

a === b; // true — one connection
```

Different params produce different managed sockets:

```ts
const lounge = chatClient.get({ room: "lounge" });
lounge === a; // false — a separate connection
```

You can assert sharing at runtime by comparing command references:

```ts
a.send === b.send; // true when they share the same socket
```

## Hook for components, instance for imperative code

- `client.useSocket(...)` is the **React entrypoint**. It subscribes to a managed socket and returns a read-only state snapshot plus connection commands.
- `client.get(...)` gives you the **managed socket instance** for imperative actions such as `open`, `send`, and `waitUntil`.

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

`useSocket` returns a `UseSocketResult` that is `SocketState` + `SocketCommands` + a selected `data` field — composed by interface extension so it can never drift from `Socket`.

## Cache-first by design

`open()` loads from the cache **before** dialing the socket. When a valid cached value exists, it renders immediately (`status: "stale"`, `isStaleData: true`) until the first live message flips it to `"success"`.

## Framework and runtime boundaries

`SocketClient` includes the React hook. `Socket`, `SocketCache`, and `EventSourceClient` do not import React directly, but that does not guarantee support in every JavaScript runtime. The socket lifecycle uses browser APIs such as `window` and `WebSocket`, and persistence uses the Cache API when available. The package also currently declares React and React DOM as peer dependencies.

Treat browser applications as the supported starting point. Other runtimes require checking their transport and lifecycle APIs rather than assuming that framework independence means runtime independence.

## Parameters describe a subscription

For a backend that chooses its stream from URL parameters, the parameters are the subscription: a room, instrument, filter, or report. Render the desired parameters and let the client find that stream’s socket.

Changing parameters selects another connection. It does not send an update frame to the existing connection. Returning to an existing serialized URL reuses its pooled socket. Use `send` for protocols that accept commands over an established connection.

Keep parameter values stable. A search field that changes on every keystroke can create many pooled sockets; debounce the committed subscription parameters when appropriate.

Pooling currently follows the serialized URL, including query-key order. Without a schema that consistently rebuilds the object, construct parameter objects in a consistent order to ensure reuse.

## Shared connection, shared commands

Calling the hook’s `close()` closes the underlying shared socket for every consumer. It also clears the socket’s subscriptions; it is not a way to unsubscribe just one component. Normal hook unmounting removes that hook’s subscription and allows the idle timeout to close an unused connection.

`enabled: false` prevents that hook from opening the socket. It does not close a connection another consumer already opened, and the hook still subscribes to its state.

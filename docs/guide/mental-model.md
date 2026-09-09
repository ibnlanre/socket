# Mental model

Understanding a few core ideas makes the rest of the API feel obvious.

## One `SocketClient` = one endpoint

A `SocketClient` represents **one WebSocket endpoint**. You construct it once with the endpoint's `url` (and optionally a `baseURL`, schemas, and connection options), and reuse it everywhere that endpoint is needed.

```ts
const chatClient = new SocketClient({
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

## React is optional

Only `SocketClient` imports React. `Socket`, `SocketCache`, and `EventSourceClient` are framework-free and usable anywhere (Node, React Native-style environments, workers, etc.).

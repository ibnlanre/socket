# Changelog

All notable changes to `@ibnlanre/socket` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-29

Paced handshakes, and stopped sockets: begin connections to a server one after another rather than all at once, and know which sockets have given up, to reopen them on request. Additive, apart from the fix below.

### Added

- `SocketGate`: paces handshakes, no more than `concurrency` (default 1) at once to any one server, the rest queued in order. Pass the same gate as `gate` to every socket or client that talks to a server that stalls or drops several handshakes begun together. A turn lasts from just before the transport is created until the handshake opens or closes, or the socket is closed, or `timeout` (default 10 seconds) passes (an error alone does not end it: the close that follows does); retries take their turn like any other attempt. A socket waiting for its turn reports `fetchStatus: "preparing"`. Each origin has its own queue unless `lane` maps several to one, as for hosts behind one proxy.

- `isExhausted` on a socket's state and on `useSocket`'s result: the socket stopped after a failure it will not retry (its retries used up, or `retry` off), and waits closed until `open()`. It stops waiting when closed on purpose or when its last subscriber leaves.
- `Socket#observe(listener)`: watch a socket's state, and its subscribers coming and going, without subscribing. An observer neither keeps the connection open nor stops it closing when idle.
- `Socket#hasSubscribers()`: whether anything subscribes to the socket now.
- `SocketClient#exhausted()`: the pooled sockets that have stopped; `SocketClient#observe(listener)`: notice when the pool's sockets change; `SocketClient#reconnect({ stagger })`: reopen the stopped ones, one after another, resolving once each has connected or stopped again, with how many connected.
- `useExhaustedSockets(clients, { stagger })`: one count of stopped sockets across several clients, with `reconnect()` and `isReconnecting` (true until each reopened socket has connected or stopped again), for an app-wide "live updates have stopped" notice. `reconnectExhausted(clients, { stagger })` is the same outside React.

### Changed

- `open()` reports `fetchStatus: "preparing"` at once, while the stored copy is read, as the lifecycle guide already described; before, it stayed `"idle"` until the connection began.

### Fixed

- A socket that gave up after an unclean close could not be reopened: it stayed marked open with no connection, so `open()` returned at once. It now closes when it stops, as it already did when preparing a connection failed, and `open()` starts it again.

## [0.3.0] - 2026-10-27

Reconnection and cache fixes, data from the server, and clearing stored data. No export was removed or renamed; the behavior changes below are fixes, listed so nothing that relied on the old behavior is caught out.

### Added

- `initialData` on `useSocket`: data the caller already has, such as a snapshot fetched on the server. It is the hook's value during server rendering and hydration, and seeds the socket when it resolves, so a stored copy never replaces it. Unlike `placeholderData` it is real data (`isPending: false`).
- `SocketClient#clearCache()`: deletes the client's store (named by `cacheKey` or the origin), as on sign-out, whether or not `disableCache` is set.
- `Socket#seed(value)` and `SocketCache#seed(value)`, which `initialData` builds on.
- Stored entries carry an `X-Socket-Cache-Encoding` header (`wire`, `cipher` or `plain`) so a read knows whether to decrypt.

### Changed

- A stored copy fills only an empty socket. State already held, from an earlier connection or `initialData`, is no longer replaced by the stored copy when a socket reopens.
- A `SocketClient` deletes its store's expired entries when it creates its first socket. Before, an entry expired only when its own path was read again, so stores collected every set of params they had seen. An `Expires` that is not a date now counts as expired; such an entry was kept forever.
- `SocketCache#clear()` deletes the store rather than its entries one by one.
- Cache Storage is opened by name for each operation rather than held open, so deleting a store (`clear()`, `clearCache()` or `caches.delete()`) never leaves a live socket writing into a store nobody can read.
- With `encrypt` set, the stored copy is `encrypt(state)` whether or not `setStateAction` is set. Before, `encrypt` applied only with a reducer.
- Before a socket resolves, `useSocket` reports constructor `placeholderData` as `isPending: true`, as the socket itself does. It reported `false`.

### Fixed

- The failure count reset when a connection opened, so a server that accepts the handshake and then drops the connection was retried at the first backoff step forever, and `retryCount` never ended it. The count now resets once a connection delivers a message or stays open for `maxRetryDelay`.
- With `setStateAction` and `encrypt` both set, the held state was the encrypted value: observers saw ciphertext, and the next message was reduced onto it. The held state is now always readable; `encrypt` applies to the stored copy only.
- With `setStateAction` and `decrypt` but no `encrypt`, the reduced state was stored as plain JSON and then passed through `decrypt` on read. It is now read as is.
- `disableCache`'s description read as the opposite of what it does.

## [0.2.0] - 2026-10-22

Runtime portability. Additive: no export was removed or renamed, and every new option is optional.

### Added

- `runtime` option on `Socket` / `SocketClient` and `EventSourceClient`: a nested object of environment adapters (`webSocket`, `eventSource`, `fetch`, `caches`). Injected adapters take precedence over ambient globals, which are resolved lazily when an operation needs them.
- `transport: "auto" | "native" | "fetch"` on `EventSourceClient`, with `client.transport` reporting the transport actually used for the current connection.
- `cacheFallback: "none" | "memory"` on the cache options, and `SocketCache.persistence: "cache-storage" | "memory" | "none"` reporting the backend actually selected.
- Exported types: `RuntimeAdapters`, `WebSocketConstructor`, `EventSourceTransport`, `EventSourceTransportMode`, `CachePersistence`.

### Changed

- `EventSourceClient` no longer selects its transport from the HTTP method. Previously `method: "GET"` forced native `EventSource` and everything else used fetch streaming, so a GET stream could not fall back to fetch where native `EventSource` was unavailable. `"auto"` now selects native only when the request *and* the requested behavior are expressible by it, and otherwise streams through fetch.
- A missing transport implementation now surfaces an actionable error at the operation that needs it, naming the option to pass, instead of a `ReferenceError`.

### Fixed

- `Socket#close()`, the pagehide handler, and outbound dispatch read `WebSocket.OPEN` / `WebSocket.CLOSED` from the global constructor. Without a global `WebSocket`, teardown threw `ReferenceError: WebSocket is not defined` even when no connection existed, and queued sends were dropped. Ready-state checks now use the specification's numeric values.

### Deprecated

- `SocketCache.isAvailable` — use `SocketCache.persistence`, which reports the backend actually selected and accounts for injected adapters.

### Migration

0.2.0 is drop-in. See [Prelaunch API changes](https://use-socket.vercel.app/guide/migration) for the new runtime options.

## [0.1.0] - 2026-09-17

Initial public release.

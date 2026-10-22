# Changelog

All notable changes to `@ibnlanre/socket` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

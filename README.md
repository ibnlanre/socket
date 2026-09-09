<h1 align="center">@ibnlanre/socket</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

`@ibnlanre/socket` is a fast, lightweight, type-safe **JSON WebSocket** client for React — cache-first, pool-aware, and schema-safe. It also ships an `EventSourceClient` for Server-Sent Events.

Define one client per endpoint, let identical params reuse a single pooled connection across components, and plug in any Standard Schema–compatible validator (Zod, Valibot, ArkType, …) for runtime validation.

## 📚 Documentation

The full documentation lives at the docs site:

**→ https://socket-xi-pink.vercel.app**

| Guides | Reference |
| --- | --- |
| [Introduction](https://socket-xi-pink.vercel.app/guide/introduction) · [Getting started](https://socket-xi-pink.vercel.app/guide/getting-started) · [Mental model](https://socket-xi-pink.vercel.app/guide/mental-model) | [`SocketClient`](https://socket-xi-pink.vercel.app/api/socket-client) · [`Socket`](https://socket-xi-pink.vercel.app/api/socket) · [`SocketCache`](https://socket-xi-pink.vercel.app/api/socket-cache) |
| [Validation](https://socket-xi-pink.vercel.app/guide/validation) · [Caching](https://socket-xi-pink.vercel.app/guide/caching) · [Reconnection](https://socket-xi-pink.vercel.app/guide/reconnection) · [Server-Sent Events](https://socket-xi-pink.vercel.app/guide/event-source) | [`EventSourceClient`](https://socket-xi-pink.vercel.app/api/event-source-client) · [Options](https://socket-xi-pink.vercel.app/api/options) · [Types & constants](https://socket-xi-pink.vercel.app/api/types) |

The docs are a VitePress site in `docs/`; run them locally with:

```bash
pnpm --filter @ibnlanre/socket-docs dev
```

## Features

- **Cache-first state** — previously received data surfaces instantly from the Cache API while fresh messages stream in (stale-while-reconnect, no empty flashes).
- **One connection per endpoint** — identical params reuse the same pooled `Socket`, so many components share a single live connection.
- **Runtime-safe messaging** — validate params, outgoing payloads, and incoming messages with any Standard Schema validator; asynchronous schemas are supported through the matching async APIs.
- **Predictable lifecycle** — distinct `status`/`fetchStatus` dimensions, derived flags, and explicit ownership (`close` vs `dispose` vs `evict`).
- **Built-in reconnection** — backoff, jitter, custom retry conditions, and recovery on network restore, window focus, and bfcache page restore.
- **Server-Sent Events** — native `EventSource` (GET) and fetch streaming (any method), named events, async iteration.

## Installation

```bash
# npm
npm install @ibnlanre/socket

# pnpm
pnpm add @ibnlanre/socket

# yarn
yarn add @ibnlanre/socket
```

Validation is optional — bring your own Standard Schema validator when you want it:

```bash
pnpm add @ibnlanre/socket zod    # or valibot, arktype, …
```

## Quick start

The smallest useful setup: create one client, call `useSocket`, render the selected data.

```tsx
import { SocketClient } from "@ibnlanre/socket";

const priceClient = new SocketClient<string>({
  baseURL: "wss://example.com",
  url: "/prices",
});

export function PriceTicker() {
  const price = priceClient.useSocket({
    select: (message) => message ?? "Waiting for price…",
  });

  return <div>{price.data}</div>;
}
```

Need the imperative socket instead?

```tsx
const socket = await priceClient.get({ symbol: "BTC" });

socket.open();
await socket.waitUntil("open");
await socket.send({ type: "subscribe", symbol: "BTC" });
```

## Key concepts

- **One `SocketClient` = one endpoint.** Schemas, cache, and reconnection live on the client.
- **Same params ⇒ same socket.** Connections are pooled by a fully resolved URL; parameters are validated/normalized once and that exact value drives both the pool key and the connection URL.
- **Hook for React, instance for imperative code.** `useSocket` returns a read-only state, selected data, and `send`; `await client.get()` returns the managed `Socket`.
- **Ownership is explicit.** `socket.close()` disconnects but preserves subscriptions (a later `open()` reconnects); `socket.dispose()` / `await client.evict(params)` release the socket permanently.
- **Sends go through an ordered queue.** `await send()` supports sync and async schemas; waiting payloads are bounded by `maxQueueSize`/`queueMaxAge`/`queueOverflow`.

See [Mental model](https://socket-xi-pink.vercel.app/guide/mental-model) for the full picture.

## Public API at a glance

| Export | Kind | Purpose |
| --- | --- | --- |
| `SocketClient` | class | Pool + React hooks for one endpoint (`useSocket`, `get`, `evict`, `clear`, `dispose`) |
| `Socket` | class | One managed connection — state snapshot + commands (`open`, `close`, `send`, `on`, `waitUntil`, `dispose`) |
| `SocketCache` | class | In-memory mirror + Cache API persistence per origin |
| `EventSourceClient` | class | One-way Server-Sent Events client (native GET + fetch streaming) |
| `SocketCloseCode` / `SocketCloseReason` | const | WebSocket close-code enums and reasons |
| Types | type | `SocketState`, `SocketCommands`, `UseSocketResult`, `SocketDiagnostic`, `SocketQueueOptions`, … |

## Development

Monorepo: `app` (the library + tests), `docs` (VitePress site), `tests` (browser e2e).

```bash
pnpm install                # install the workspace

# unit tests + typecheck (app)
pnpm --dir app test

# browser e2e (Playwright; keep port 4173 free — it reuses an existing server)
pnpm test:e2e

# docs
pnpm --filter @ibnlanre/socket-docs dev     # local docs site
pnpm --filter @ibnlanre/socket-docs build   # build docs
```

## License

`@ibnlanre/socket` is licensed under the [BSD-3][bsd-3] License. See the [LICENSE][license] file for details.

[license]: LICENSE
[bsd-3]: https://opensource.org/license/bsd-3-clause

### Async validation and ownership

`await client.get(input, { signal })` resolves parameters and returns the pooled socket. `useSocket` owns the same resolution in React and exposes `isPreparing` and `error`. `await socket.send(payload, { signal })` validates sync or async schemas while preserving send order. Schema input and output types may differ.

`socket.close()` disconnects while preserving subscriptions. `socket.dispose()` is permanent; `client.evict(params)` disposes and removes a pooled instance. Queues and pools are bounded. `onDiagnostic` exposes retry, queue, validation, and cache activity; `prepareConnection` supports fresh credentials before every transport attempt.

See [migration notes](docs/guide/migration.md) for changed encoding, queue, and ownership behavior.

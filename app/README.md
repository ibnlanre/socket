<h1 align="center">@ibnlanre/socket</h1>

<div align="center">

[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)

</div>

A fast, lightweight, type-safe **JSON WebSocket** client for React — cache-first, pool-aware, and schema-safe. Ships an `EventSourceClient` for Server-Sent Events too.

Define one client per endpoint, let identical params share a single pooled connection across components, and validate at the edges with any [Standard Schema](https://github.com/standard-schema/standard-schema)–compatible library (Zod, Valibot, ArkType, …).

**📖 Docs → https://use-socket.vercel.app**

## Install

```bash
npm install @ibnlanre/socket
```

`react` and `react-dom` (`>=16.8`) are peer dependencies. Validation is optional — bring your own validator when you want it:

```bash
npm install zod    # or valibot, arktype, …
```

## Usage

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

Outside React, `get` hands you the managed socket:

```ts
const socket = await priceClient.get({ symbol: "BTC" });

socket.open();
await socket.waitUntil("open");
await socket.send({ type: "subscribe", symbol: "BTC" });

const off = socket.on("message", (event) => console.log(event));
off();
socket.close();
```

With runtime validation — params, outgoing payloads, and incoming messages:

```tsx
import { SocketClient } from "@ibnlanre/socket";
import { z } from "zod";

const chatClient = new SocketClient({
  baseURL: "wss://chat.example.com",
  url: "/ws",
  paramsSchema: z.object({ room: z.string() }),
  sendSchema: z.object({ content: z.string().min(1) }),
  messageSchema: z.object({
    sender: z.string(),
    content: z.string(),
    timestamp: z.number(),
  }),
  retry: true,
});

function ChatRoom({ room }: { room: string }) {
  const socket = chatClient.useSocket({ params: { room } });
  return <button onClick={() => socket.send({ content: "Hello!" })}>Send</button>;
}
```

## Features

- **Cache-first state** — previously received data surfaces instantly from the Cache API while fresh messages stream in; no empty flashes on remount.
- **One connection per endpoint** — identical params reuse the same pooled `Socket`, so many components share a single live connection.
- **Runtime-safe messaging** — validate params, outgoing payloads, and incoming messages with any Standard Schema validator, including asynchronous schemas.
- **Predictable lifecycle** — distinct `status`/`fetchStatus` dimensions, derived flags, and explicit ownership (`close` vs `dispose` vs `evict`).
- **Built-in reconnection** — backoff, jitter, custom retry conditions, and recovery on network restore, window focus, and bfcache page restore.
- **Server-Sent Events** — native `EventSource` (GET) and fetch streaming (any method), named events, async iteration.

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `SocketClient` | class | Pool + React hooks for one endpoint (`useSocket`, `get`, `evict`, `clear`, `dispose`) |
| `Socket` | class | One managed connection — state snapshot and commands (`open`, `close`, `send`, `on`, `waitUntil`, `dispose`) |
| `SocketCache` | class | In-memory mirror plus Cache API persistence per origin |
| `EventSourceClient` | class | One-way Server-Sent Events client (native GET and fetch streaming) |
| `SocketCloseCode` / `SocketCloseReason` | const | WebSocket close-code enums and reasons |
| Types | type | `SocketState`, `SocketCommands`, `UseSocketResult`, `SocketDiagnostic`, `SocketQueueOptions`, … |

## Key concepts

- **One `SocketClient` = one endpoint.** Schemas, cache, and reconnection live on the client.
- **Same params ⇒ same socket.** Connections are pooled by a fully resolved URL; parameters are validated once and that exact value drives both the pool key and the connection URL.
- **Hook for React, instance for imperative code.** `useSocket` returns a read-only state, selected data, and `send`; `await client.get()` returns the managed `Socket`.
- **Ownership is explicit.** `socket.close()` disconnects but preserves subscriptions (a later `open()` reconnects); `socket.dispose()` and `await client.evict(params)` release the socket permanently.

## Requirements

- Node 18+ (global `EventSource` and `fetch`, or a `WebSocket` implementation in the runtime)
- React `>=16.8` when using the hooks

## License

BSD-3-Clause © [Ridwan Olanrewaju](https://github.com/ibnlanre). See [LICENSE](https://github.com/ibnlanre/socket/blob/main/LICENSE).

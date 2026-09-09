# Introduction

`@ibnlanre/socket` is a fast, lightweight, and type-safe **JSON WebSocket** client built to supercharge your developer experience (DX). It is designed with a cache-first approach and flexible configuration, making it effortless to manage WebSocket connections.

It is built for React apps that need a predictable way to:

- open sockets,
- reuse them across components,
- validate messages, and
- recover cleanly from disconnects.

You can use it declaratively through a hook (`client.useSocket(...)`) or imperatively through a socket instance (`client.get(...)`). It also ships with an `EventSourceClient` for Server-Sent Events when you need a simpler one-way connection.

## Features

- **Cache-first state** — previously received data surfaces immediately while fresh messages continue streaming in. Cached values are stored in the Cache API and expire after a configurable age.
- **React-friendly API** — use one client through a hook for components, or access the underlying socket directly when you need imperative control.
- **Runtime-safe messaging** — plug in any Standard Schema–compatible library (Zod, Valibot, ArkType, and others) to validate params, outgoing payloads, and incoming messages.
- **bfcache-friendly** — closes connections on `pagehide` and reconnects on `pageshow`, so the browser can cache your page without issues.
- **Built-in reconnect behavior** — retry with delays, backoff, jitter, and custom close-condition logic.
- **Server-Sent Events** — ships with an `EventSourceClient` that supports native `EventSource` (GET) and fetch-based streaming (any HTTP method) with async iterator support.

## What you get

| Export | Kind | Purpose |
| --- | --- | --- |
| `SocketClient` | class | React hook host + pool of shared `Socket` instances for one endpoint |
| `Socket` | class | A single managed JSON WebSocket connection |
| `SocketCache` | class | In-memory mirror + Cache API persistence per origin |
| `EventSourceClient` | class | One-way Server-Sent Events client |
| `SocketCloseCode` / `SocketCloseReason` | const | Close code enums and human-readable reasons |

A full list of exported types lives in [Reference → Types & constants](/api/types).

## A minimal example

```tsx
import { SocketClient } from "@ibnlanre/socket";

const priceClient = new SocketClient<string>({
  baseURL: "wss://example.com",
  url: "/prices",
});

export function PriceTicker() {
  const price = priceClient.useSocket({
    select: (message) => message ?? "Waiting for price...",
  });

  return <div>{price.data}</div>;
}
```

## Quick links

- [Getting started](/guide/getting-started) — the smallest useful setup.
- [Mental model](/guide/mental-model) — how the pieces fit together.
- [Socket pooling](/guide/socket-pooling) — one connection shared by many components.

<h1 align="center">@ibnlanre/socket 🚀</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

`@ibnlanre/socket` is a fast, lightweight, and type-safe **JSON WebSocket** client built to supercharge your developer experience (DX). Designed with a cache-first approach and flexible configuration, it makes managing WebSocket connections effortless and efficient.

It is built for React apps that need a predictable way to open sockets, reuse them across components, validate messages, and recover cleanly from disconnects. You can use it declaratively through a hook or imperatively through the socket instance. It also ships with an `EventSourceClient` for Server-Sent Events when you need a simpler one-way connection.

In practice, the flow is simple: define one client per endpoint, let the library reuse sockets for identical params, and optionally plug in any Standard Schema-compatible validator (Zod, Valibot, ArkType, and others) for runtime validation and type inference.

## Features

- **Cache-first state**: Surfaces previously received data quickly while fresh messages continue streaming in.
- **React-friendly API**: Use one client through a hook for components or access the underlying socket directly when you need imperative control.
- **Runtime-safe messaging**: Plug in any Standard Schema-compatible library (Zod, Valibot, ArkType, and others) to validate params, outgoing payloads, and incoming messages.
- **bfcache-friendly**: Closes connections on `pagehide` and reconnects on `pageshow`, so the browser can cache your page without issues.
- **Built-in reconnect behavior**: Retry with delays, backoff, jitter, and custom close-condition logic.
- **Server-Sent Events**: Ships with an `EventSourceClient` that supports native `EventSource` (GET) and fetch-based streaming (any HTTP method) with async iterator support.

## Documentation

Full documentation is available at the docs site (deployed to Vercel). It covers guides, concepts, and API references for `SocketClient`, `Socket`, `SocketCache`, and `EventSourceClient`.

The docs live in `docs/` as a VitePress site. To run it locally:

```bash
pnpm --filter @ibnlanre/socket-docs dev
```

## Getting Started

To get started with `@ibnlanre/socket`:

1. Install the package.
2. Create a client for a single WebSocket endpoint.
3. Use `client.useSocket(...)` in React or `client.get(...)` when you want the socket instance directly.

## Installation

The library uses Standard Schema under the hood, so it works with any Standard Schema-compatible validator. Bring your own — Zod, Valibot, ArkType, or whatever you prefer.

<details open>
  <summary>
    Using NPM
  </summary>

  <br />

  ```bash
  npm install @ibnlanre/socket
  ```
</details>

<details>
  <summary>
    Using Yarn
  </summary>

  <br />

  ```bash
  yarn add @ibnlanre/socket
  ```
</details>

<details>
  <summary>
    Using PNPM
  </summary>

  <br />

  ```bash
  pnpm add @ibnlanre/socket
  ```
</details>

If you want runtime validation, install your validator of choice alongside it:

```bash
pnpm add @ibnlanre/socket zod
# or
pnpm add @ibnlanre/socket valibot
```

## Quick start

This is the smallest useful setup: create one client, call `useSocket`, and render the selected data.

```tsx
import { SocketClient } from "@ibnlanre/socket";

const priceClient = new SocketClient<string>({
  baseURL: "wss://example.com",
  url: "/prices",
});

export function PriceTicker() {
  const price = priceClient.useSocket({
    select: (message) => {
      if (!message) return "Waiting for price...";
      return message;
    },
  });

  return <div>{price.data}</div>;
}
```

## End-to-End Testing

The browser-level e2e test validates the socket library itself through its dedicated harness in `app/e2e`, connected to a real local WebSocket test server. The chat demo in `app/example` remains independent.

```bash
pnpm test:e2e
```

## Mental model

- One `SocketClient` instance represents one WebSocket endpoint.
- `client.useSocket(...)` is the React entrypoint. It subscribes to a managed socket and returns a read-only state snapshot plus connection commands.
- `client.get(...)` gives you the managed socket instance for imperative actions like `open`, `send`, and `waitUntil`.
- The same params reuse the same underlying socket. Different params create different managed sockets.

## Usage

### Create a client

Use `SocketClient` to define one reusable client for one endpoint. Runtime schemas are optional, but when you provide them they validate data at runtime and also drive TypeScript inference.

```tsx
import { SocketClient, SocketCloseCode } from "@ibnlanre/socket";
import { z } from "zod";

const marketSummaryOverviewClient = new SocketClient({
  baseURL: "wss://new.base.url/",
  url: "/ws/new-endpoint/market_overview/unique_id",
  paramsSchema: z.object({
    currency_code: z.string().optional(),
  }),
  sendSchema: z.object({
    type: z.literal("subscribe"),
    currency_code: z.string().optional(),
  }),
  messageSchema: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("success"),
      data: z.object({
        messages: z.object({
          summary: z.object({
            status: z.string(),
          }),
        }),
      }),
    }),
    z.object({
      type: z.literal("error"),
      message: z.string(),
    }),
  ]),
  retry: true,
  retryDelay: 2000,
  minJitterValue: 0.9,
  retryCount: 5,
  retryOnSpecificCloseCodes: [SocketCloseCode.ABNORMAL_CLOSURE],
  retryOnCustomCondition: (event, socket) => {
    return event.code === SocketCloseCode.PROTOCOL_ERROR;
  },
});
```

### What `useSocket(...)` gives you back

The hook returns a read-only reactive snapshot plus `open`, `close`, `send`, `waitUntil`, and `on` commands. Transport internals such as `ws`, cache storage, and the mutable socket instance stay behind `client.get(...)`.

- `data`: The selected value returned by your `select` function. Before a message arrives, `select` runs against `undefined` (or `placeholderData` if configured).
- `value`: The latest full socket message after schema parsing.
- `status`: One of `loading`, `success`, `error`, `idle`, or `stale`.
- `fetchStatus`: One of `idle`, `connecting`, `connected`, or `disconnected`.
- `isIdle`, `isConnecting`, `isConnected`, `isDisconnected`: Derived connection flags.
- `isLoading`, `isSuccess`, `isError`, `isPending`, `isRefetching`, `isRefetchError`, `isStaleData`: Derived state flags.
- `failureCount`, `failureReason`, `error`, `dataUpdatedAt`, `errorUpdatedAt`, `isPlaceholderData`: Useful connection and failure metadata.
- `binaryType`: The binary frame type (`"blob"` or `"arraybuffer"`).
- `open`, `close`, `send`, `waitUntil`, `on`: Imperative commands when you need them. `on` returns an unsubscribe function; handlers are keyed by reference (distinct handlers each own a subscription, re-registering the same handler is a no-op); listeners survive automatic reconnects and are dropped when the socket is explicitly closed.

### Parameters

`SocketClient` accepts a configuration object with these options:

**General**
- `baseURL`: The base URL of the WebSocket server.
- `url`: The endpoint URL for the WebSocket connection.
- `messageSchema`: A runtime schema for WebSocket messages received from the server. It also becomes the inferred message type for `value`, `select`, and subscribers.
- `paramsSchema`: A synchronous runtime schema for URL params passed through the client options object. It also becomes the inferred params type for `useSocket` and `get`.
- `sendSchema`: A synchronous runtime schema for JSON messages sent through `send`. It also becomes the inferred payload type for those calls.
- `binaryType` (default: `"blob"`): Preferred binary frame representation for the managed WebSocket.
- `protocols`: The protocols to use for the WebSocket connection.

**Caching**
- `cacheKey`: The key to use for caching the data.
- `clearCacheOnClose` (default: `false`): Whether to clear the cache when the connection is closed.
- `disableCache` (default: `false`): Whether to disable the cache or not.
- `maxCacheAge` (default: `15mins`): The maximum age of the cached data.

Cache data is stored through the browser Cache API. Do not enable it for sensitive messages unless your cache key, retention period, and encryption strategy are appropriate for your application.

**Data Handling**
- `deduplicationWindow`: The time window in which identical outbound payloads are deduplicated. Set to `0` to disable.
- `decrypt`: A function to decrypt the received data.
- `decryptData` (default: `true`): Whether to decrypt the received data or not.
- `encrypt`: A function to encrypt the available data.
- `encryptPayload` (default: `true`): Whether to encrypt the payload or not.
- `messageFailurePolicy`: Configure how the socket handles decode, parse, and validation failures for inbound messages. Each stage can be `"recover"` (log and continue) or `"close"` (close the connection).
- `placeholderData`: Seeds the socket with a complete message-shaped value before live data arrives. Your `select` function still runs against this value.
- `setStateAction`: The reducer to construct the next state.

**Logging**
- `log`: The events to log in the console.
- `logCondition`: A custom condition for logging.

**Retry and reconnect**
- `retry` (default: `false`): Whether to retry the WebSocket connection or not.
- `retryDelay` (default: `5secs`): The delay before retrying the WebSocket connection.
- `retryCount` (default: `3`): The number of times to retry the WebSocket connection.
- `reconnectOnNetworkRestore` (default: `true`): Whether to retry the connection when the network is restored.
- `reconnectOnWindowFocus` (default: `true`): Whether to retry the connection when the window regains focus.
- `reconnectOnPageRestore` (default: `true`): Whether to reconnect when the page is restored from the back/forward cache (bfcache). Closes the socket on `pagehide` and reconnects on `pageshow`.
- `retryBackoffStrategy` (default: `exponential`): The strategy for increasing the delay between retries.
- `maxRetryDelay` (default: `1min`): The maximum delay between retries.
- `retryOnSpecificCloseCodes`: An array of specific close codes that should trigger a retry.
- `retryOnCustomCondition`: A custom function to determine whether to retry.
- `minJitterValue` (default: `0.8`): The minimum value for the jitter.
- `maxJitterValue` (default: `1.2`): The maximum value for the jitter.
- `idleConnectionTimeout` (default: `5mins`): The time to wait before closing an idle connection.

### Returns

`SocketClient` provides these methods:

- `get`: Returns the managed socket for a params key, creating it if needed.
- `close`: Closes and removes one managed socket. Returns `true` when a socket existed.
- `closeAll`: Closes and removes every managed socket created by the client, returning the number removed.
- `useSocket`: React hook that subscribes to one managed socket and returns a reactive, read-only result plus commands.

The library also exports `EventSourceClient` for Server-Sent Events. It supports both native `EventSource` (GET requests) and fetch-based streaming (any HTTP method) with the same retry and backoff patterns.

Multiple calls with the same params reuse the same underlying socket instance. Different params create different managed sockets.

### React usage

`client.useSocket(...)` is the reactive entrypoint. It opens the managed socket on mount unless `enabled` is `false`, subscribes to state changes, and returns a read-only snapshot merged with the selected `data`.

```tsx
function socketOptions(currency_code?: string) {
  return {
    params: { currency_code },
    select(response) {
      if (!response) {
        return "Message not received yet";
      }

      if (response.type === "error") {
        return response.message;
      }

      return response.data.messages.summary.status;
    },
  };
}

export default function App() {
  const options = socketOptions("USD");
  const marketSummaryOverview = marketSummaryOverviewClient.useSocket(options);

  return <div>{marketSummaryOverview.data}</div>;
}
```

`useSocket` accepts these options:

- `params`: Query params used to build the socket URL and cache key.
- `enabled` defaulting to `true`: Stops `open()` from running until you are ready.
- `select`: Maps the latest socket message into the shape your component wants.

### Imperative usage

Imperative actions live on the managed socket from `client.get(...)`. The hook result exposes safe connection commands but intentionally does not expose mutable transport internals.

```tsx
const socket = marketSummaryOverviewClient.get({
  params: { currency_code: "USD" },
});

socket.open();
await socket.waitUntil("open");
socket.send({
  type: "subscribe",
  currency_code: "USD",
});
```

The hook result exposes the same socket methods, so React code can stay local when needed:

```tsx
function SubscribeOnOpen() {
  const marketSummaryOverview = marketSummaryOverviewClient.useSocket({
    params: { currency_code: "USD" },
  });

  useEffect(() => {
    marketSummaryOverview.waitUntil("open").then(() => {
      marketSummaryOverview.send({
        type: "subscribe",
        currency_code: "USD",
      });
    });
  }, [marketSummaryOverview]);

  return null;
}
```

## API Reference

<details>
  <summary>
    <code>Socket</code>: The core WebSocket wrapper that manages connection, state, retry, caching, and event dispatch.
  </summary>

  Typically accessed through `client.get(...)`. It exposes the full imperative API, including `subscribe`. `on` returns an unsubscribe function, supports multiple handlers for an event (keyed by handler reference — distinct handlers each own their subscription; registering the same handler again is a no-op), and carries subscriptions across automatic reconnects — subscriptions are torn down only when the socket is explicitly closed.
</details>

<details>
  <summary>
    <code>SocketClient</code>: The top-level client that pools managed socket instances by params key.
  </summary>

  Instantiated with `new SocketClient(config)`. Provides `get`, `close`, `closeAll`, and `useSocket`.
</details>

<details>
  <summary>
    <code>SocketCache</code>: Wraps the browser Cache API for socket data persistence.
  </summary>

  Handles cache initialization, read/write with expiry, encryption/decryption, and state observation. Exposes `clear`, `get`, `has`, `initialize`, `subscribe`, `remove`, `set`, and a `value` getter.
</details>

<details>
  <summary>
    <code>SocketCloseCode</code>: An enumeration of WebSocket close codes.
  </summary>

  ### Example

  ```tsx
  import { SocketCloseCode } from "@ibnlanre/socket";

  const CLOSURE = SocketCloseCode.NORMAL_CLOSURE;
  //    ^? 1000
  ```
</details>

<details>
  <summary>
    <code>SocketCloseReason</code>: An object representing the WebSocket close reasons.
  </summary>

  ### Example

  ```tsx
  import { SocketCloseReason, SocketCloseCode } from "@ibnlanre/socket";

  const REASON = SocketCloseReason[SocketCloseCode.NORMAL_CLOSURE];
  //    ^? "The connection was closed cleanly"
  ```
</details>

<details>
  <summary>
    <code>EventSourceClient</code>: A client for Server-Sent Events (SSE).
  </summary>

  Supports native `EventSource` for GET requests and fetch-based streaming for any HTTP method — named events work on both transports. Comes with retry, backoff, named event subscriptions, async iteration, and observable `status` (`idle`, `connecting`, `open`, or `error`) and `error` fields.

  ```tsx
  import { EventSourceClient } from "@ibnlanre/socket";

  const client = new EventSourceClient({ url: "https://example.com/events" });
  const unsubscribe = client.on("update", (event) => {
    console.log(event.data);
  });
  client.open();
  client.close();
  unsubscribe();

  // Async iteration
  for await (const event of client) {
    console.log(event.data);
  }
  ```
</details>

<details>
  <summary>
    <code>EventSourceClientOptions</code>: Configuration options for the SSE client.
  </summary>

  Extends `RequestInit` with SSE-specific options like `url`, `baseURL`, `method`, and `messageSchema`, and inherits retry/backoff options from `ReconnectionPolicy` (`retry`, `retryDelay`, `retryCount`, `retryBackoffStrategy`, `maxRetryDelay`, `minJitterValue`, `maxJitterValue`).
</details>

## License

`@ibnlanre/socket` is licensed under the [BSD-3][bsd-3] License. For more information, please refer to the [LICENSE][license] file.

[license]: LICENSE
[bsd-3]: https://opensource.org/license/bsd-3-clause

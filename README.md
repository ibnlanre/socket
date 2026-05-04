<h1 align="center">@ibnlanre/socket 🚀</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

`@ibnlanre/socket` is a fast, lightweight, and type-safe WebSocket client built to supercharge your developer experience (DX). Designed with a cache-first approach and flexible configuration, it makes managing WebSocket connections effortless and efficient.

It is built for React apps that need a predictable way to open sockets, reuse them across components, validate messages, and recover cleanly from disconnects. You can use it declaratively through a hook or imperatively through the socket instance.

In practice, the flow is simple: define one client per endpoint, let the library reuse sockets for identical params, and optionally add Zod schemas for runtime validation and type inference.

This library targets browser-based React apps. It uses the browser `WebSocket` API and can persist cached payloads through the Cache API when that API is available. If the Cache API is unavailable, the socket still works, but cache persistence is skipped.

## Features

- **Cache-first state**: Surfaces previously received data quickly while fresh messages continue streaming in.
- **React-friendly API**: Use one client through a hook for components or access the underlying socket directly when you need imperative control.
- **Runtime-safe messaging**: Plug in Zod schemas to validate params, outgoing payloads, and incoming messages.
- **Built-in reconnect behavior**: Retry with delays, backoff, jitter, and custom close-condition logic.

## Getting Started

To get started with `@ibnlanre/socket`:

1. Install the package and its Zod peer dependency.
2. Create a client for a single WebSocket endpoint.
3. Use `client.use(...)` in React or `client.get(...)` when you want the socket instance directly.

## Installation

`zod` is a peer dependency. Install both packages:

<details open>
  <summary>
    Using NPM
  </summary>

  <br />

  ```bash
  npm install @ibnlanre/socket zod
  ```
</details>

<details>
  <summary>
    Using Yarn
  </summary>

  <br />

  ```bash
  yarn add @ibnlanre/socket zod
  ```
</details>

<details>
  <summary>
    Using PNPM
  </summary>

  <br />

  ```bash
  pnpm add @ibnlanre/socket zod
  ```
</details>

## Quick start

This is the smallest useful setup: create one client, call `use`, and render the selected data.

```tsx
import { createSocketClient } from "@ibnlanre/socket";

const priceClient = createSocketClient<string>({
  baseURL: "wss://example.com",
  url: "/prices",
});

export function PriceTicker() {
  const price = priceClient.use({
    select: (message) => message,
    initialData: "Waiting for price...",
  });

  return <div>{price.data}</div>;
}
```

## End-to-End Testing

The browser-level e2e test is meant to validate the socket library itself, not a separate demo surface. It drives the example app in `app/example` and connects that app to a real local WebSocket test server.

```bash
pnpm test:e2e
```

## Mental model

- One client represents one WebSocket endpoint.
- `client.use(...)` is the React entrypoint. It subscribes to a managed socket and returns reactive state plus socket methods.
- `client.get(...)` gives you the managed socket instance for imperative actions like `open`, `send`, and `waitUntil`.
- The same params reuse the same underlying socket. Different params create different managed sockets.

## Usage

### Create a client

Use `createSocketClient` to define one reusable client for one endpoint. Runtime schemas are optional, but when you provide them they validate data at runtime and also drive TypeScript inference.

```tsx
import { createSocketClient, SocketCloseCode } from "@ibnlanre/socket";
import { z } from "zod";

const marketSummaryOverviewClient = createSocketClient({
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
  retryOnSpecificCloseCodes: [SocketCloseCode.AbnormalClosure],
  retryOnCustomCondition: (event, socket) => {
    return event.code === SocketCloseCode.PROTOCOL_ERROR;
  },
});
```

### What `use(...)` gives you back

The hook returns the socket instance plus a reactive `data` field.

- `data`: The selected value returned by your `select` function, or `initialData` before a message arrives.
- `value`: The latest full socket message after schema parsing.
- `status`: One of `loading`, `success`, `error`, `idle`, or `stale`.
- `fetchStatus`: One of `idle`, `connecting`, `connected`, or `disconnected`.
- `isIdle`, `isConnecting`, `isConnected`, `isDisconnected`: Derived connection flags.
- `isLoading`, `isSuccess`, `isError`, `isPending`, `isRefetching`, `isRefetchError`, `isStaleData`: Derived state flags.
- `failureCount`, `failureReason`, `error`, `dataUpdatedAt`, `errorUpdatedAt`: Useful connection and failure metadata.
- `open`, `close`, `send`, `subscribe`, `waitUntil`, `on`: Imperative socket methods when you need them.

### Parameters

`createSocketClient` accepts a configuration object with these options:

**General**
- `baseURL`: The base URL of the WebSocket server.
- `url`: The endpoint URL for the WebSocket connection.
- `messageSchema`: A runtime schema for WebSocket messages received from the server. It also becomes the inferred message type for `value`, `select`, and subscribers.
- `paramsSchema`: A runtime schema for URL params passed through the client options object. It also becomes the inferred params type for `use`, `initialize`, and `cleanup`.
- `sendSchema`: A runtime schema for messages sent through `send`. It also becomes the inferred payload type for those calls.
- `enabled` (default: `true`): Whether to enable the WebSocket connection or not.
- `protocols`: The protocols to use for the WebSocket connection.

**Caching**
- `cacheKey`: The key to use for caching the data.
- `clearCacheOnClose` (default: `false`): Whether to clear the cache when the connection is closed.
- `disableCache` (default: `false`): Whether to disable the cache or not.
- `maxCacheAge` (default: `15mins`): The maximum age of the cached data.

**Data Handling**
- `decrypt`: A function to decrypt the received data.
- `decryptData` (default: `false`): Whether to decrypt the received data or not.
- `encrypt`: A function to encrypt the available data.
- `encryptPayload` (default: `false`): Whether to encrypt the payload or not.
- `placeholderData`: Seeds the socket with a complete message-shaped value before live data arrives. Your `select` function still runs against this value.
- `setStateAction`: The reducer to construct the next state.

**Logging**
- `log`: The events to log in the console.
- `logCondition`: A custom condition for logging.

**Retry and reconnect**
- `retry` (default: `true`): Whether to retry the WebSocket connection or not.
- `retryDelay` (default: `5secs`): The delay before retrying the WebSocket connection.
- `retryCount` (default: `3`): The number of times to retry the WebSocket connection.
- `reconnectOnNetworkRestore` (default: `true`): Whether to retry the connection when the network is restored.
- `reconnectOnWindowFocus` (default: `true`): Whether to retry the connection when the window regains focus.
- `retryBackoffStrategy` (default: `fixed`): The strategy for increasing the delay between retries.
- `maxRetryDelay` (default: `1min`): The maximum delay between retries.
- `retryOnSpecificCloseCodes`: An array of specific close codes that should trigger a retry.
- `retryOnCustomCondition`: A custom function to determine whether to retry.
- `minJitterValue` (default: `0.8`): The minimum value for the jitter.
- `maxJitterValue` (default: `1.2`): The maximum value for the jitter.
- `idleConnectionTimeout` (default: `5mins`): The time to wait before closing an idle connection.

### Returns

Calling `createSocketClient` returns a client with these methods:

- `get`: Returns the managed socket for a params key, creating it if needed.
- `close`: Closes and removes one managed socket. Returns `true` when a socket existed.
- `closeAll`: Closes and removes every managed socket created by the client.
- `preset`: Returns the same options object, but keeps the selected data type attached so you can reuse the config cleanly.
- `use`: React hook that subscribes to one managed socket and returns the socket instance plus a reactive `data` field.

Multiple calls with the same params reuse the same underlying socket instance. Different params create different managed sockets.

### React usage

`client.use(...)` is the reactive entrypoint. It opens the managed socket on mount unless `enabled` is `false`, subscribes to state changes, and returns the socket instance merged with the selected `data`.

```tsx
function socketOptions(currency_code?: string) {
  return marketSummaryOverviewClient.preset({
    params: { currency_code },
    initialData: "Message not received yet",
    select(response) {
      if (!response) {
        return "Message not received yet";
      }

      if (response.type === "error") {
        return response.message;
      }

      return response.data.messages.summary.status;
    },
  });
}

export default function App() {
  const options = socketOptions("USD");
  const marketSummaryOverview = marketSummaryOverviewClient.use(options);

  return <div>{marketSummaryOverview.data}</div>;
}
```

`use` accepts these options:

- `params`: Query params used to build the socket URL and cache key.
- `enabled` defaulting to `true`: Stops `open()` from running until you are ready.
- `select`: Maps the latest socket message into the shape your component wants.
- `initialData`: Fallback for the selected return value before any socket message is available.

`initialData` is for the selected output. `placeholderData` in the client config is different: it seeds the underlying socket with a full message-shaped value before live data arrives, and `select` still runs against it.

### Imperative usage

Imperative actions live on the socket instance itself. You can get that instance either through `client.get(...)` or from the object returned by `client.use(...)`.

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
  const marketSummaryOverview = marketSummaryOverviewClient.use({
    params: { currency_code: "USD" },
    select: (response) => response,
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
    <code>SocketCloseCode</code>: An enumeration of WebSocket close codes.
  </summary>

  ### Example

  ```tsx
  import { SocketCloseCode } from "@ibnlanre/socket";

  const CLOSURE =  SocketCloseCode.NormalClosure;
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

  const REASON =  SocketCloseReason[SocketCloseCode.NormalClosure];
  //    ^? "The connection was closed cleanly"
  ```
</details>

<details>
  <summary>
    <code>getUri</code>: A function to get the URI of the WebSocket connection.
  </summary>

  ### Example

  ```tsx
  import { getUri } from "@ibnlanre/socket";

  const URI = getUri({ baseURL: "wss://example.com", url: "/ws/v1" });
  //    ^? "wss://example.com/ws/v1"
  ```
</details>

## License

`@ibnlanre/socket` is licensed under the [BSD-3][bsd-3] License. For more information, please refer to the [LICENSE][license] file.

[license]: LICENSE
[bsd-3]: https://opensource.org/license/bsd-3-clause

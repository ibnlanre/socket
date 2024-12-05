<h1 align="center">@ibnlanre/socket 🚀</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

`@ibnlanre/socket` is a fast, lightweight, and type-safe WebSocket client built to supercharge your developer experience (DX). Designed with a cache-first approach and flexible configuration, it makes managing WebSocket connections effortless and efficient.

This library is optimized for delivering a superior user experience. Its cache-first design makes your app feel faster by providing instant access to stored data while fetching updates in the background. Meanwhile, the retry mechanism ensures uninterrupted real-time data flow, so your users never miss a beat.

## Features

- **Blazing-Fast Caching**: Keeps previously received data readily available, with background updates to ensure speed and freshness.
- **Real-Time Data Streaming**: Seamlessly integrates live data updates into your app.
- **Subscription Management**: Easy and intuitive APIs for managing multiple WebSocket subscriptions.
- **Retry Mechanism**: Automatically re-establishes connections during network hiccups or server downtime to minimize disruptions.

## Getting Started

To get started with the `@ibnlanre/socket` library, follow these steps:

1. Install the library using a package manager.
2. Create a socket client using the `createSocketClient` function.
3. Use the client in your components to subscribe to data streams and handle updates.

## Installation

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
  pnpm install @ibnlanre/socket
  ```
</details>

## Usage

```tsx
  import { createSocketClient, SocketCloseCode } from "@ibnlanre/socket";

  type StockMarketOverview = {
    last_updated: string;
    notifications: {
      summary: {
        status: string;
        last_updated: string;
        notifications: {
          total_securities: string;
          listed_contracts: string;
          boards: Array<{ name: string; code: string; }>;
        };
        is_post_connection: string;
      };
    };
  };

  type StockMarketOverviewParams = {
    currency?: string;
  };

  const client = createSocketClient<
    StockMarketOverview,
    StockMarketOverviewParams
  >({
    baseURL: "wss://new.base.url/",
    url: "/ws/new-endpoint/market_overview/unique_id",
    retryDelay: 2000,
    minJitterValue: 0.9,
    retryCount: 5,
    retryOnSpecificCloseCodes: [SocketCloseCode.AbnormalClosure],
    retryOnCustomCondition: (event, socket) => {
      return event.code === SocketCloseCode.PROTOCOL_ERROR
    },
  });

  export default function App() {
    const { data, isPending } = client.use({ currency: "USD" }, (data) => {
      if (!data) return;
      return data.notifications.summary.notifications;
    });

    if (isPending) return <div>Loading...</div>;

    return (
      <div>
        <h1>Stock Market Overview</h1>
        <p>Total Securities: {data?.totalSecurities}</p>
        <p>Listed Contracts: {data?.listedContracts}</p>
        <p>Boards: {data?.boards.map(({ name }) => name).join(", ")}</p>
      </div>
    );
  }
  ```

## `use` Hook

#### Actions

- `close`: A function to close the WebSocket connection.
- `open`: A function to open the WebSocket connection.
- `send`: A function to send a message to the WebSocket server.

#### Handlers
- `subscribe`: Subscribes to data changes and updates the component.
- `on`: Subscribes to a specific WebSocket event.

#### State

- `value`: The data received from the WebSocket server.
- `data`: The data received after transformation by the `select` function.

#### Status

- `isPending`: A boolean indicating whether the data is loading or not.
- `isError`: A boolean indicating whether an error occurred or not.
- `isSuccess`: A boolean indicating whether the data was successfully fetched or not.
- `isStaleData`: A boolean indicating whether the data is stale or not.
- `isPlaceholderData`: A boolean indicating whether the data is a placeholder or not.
- `isRefetching`: A boolean indicating whether the data is being refetched or not.
- `isRefetchError`: A boolean indicating whether an error occurred during refetching or not.
- `isActive`: A boolean indicating whether the WebSocket connection is active or not.
- `isInactive`: A boolean indicating whether the WebSocket connection is inactive or not.

#### Metadata

- `cache`: The cache object containing the data and metadata.
- `error`: The error object containing the error message and details.
- `fetchStatus`: The fetch status indicating the state of the data fetch.
- `failureCount`: The number of times the data fetch has failed.
- `failureReason`: The reason for the data fetch failure.
- `path`: The path of the WebSocket connection.
- `status`: The status of the WebSocket connection.
- `ws`: The WebSocket object representing the connection.
- `dataUpdatedAt`: The timestamp when the data was last updated.
- `errorUpdatedAt`: The timestamp when the error occurred.

## API Reference

<details>
  <summary>
    <code>createSocketClient</code>: A function to create a WebSocket client.
  </summary>

  <br />

  - `initialize`: A function to initialize the socket client.
  - `use`: Subscribes to a data stream and returns the data, loading state, and error.
  - `sockets`: A map of WebSocket connections created by the client.

  ### Configuration

  You can configure the socket client by providing the following options:

  #### General

  - `baseURL`: The base URL of the WebSocket server.
  - `url`: The endpoint URL for the WebSocket connection.
  - `enabled`: Whether to enable the WebSocket connection or not.
  - `protocols`: The protocols to use for the WebSocket connection.

  #### Caching

  - `cacheKey`: The key to use for caching the data.
  - `clearCacheOnClose`: Whether to clear the cache when the connection is closed.
  - `disableCache`: Whether to disable the cache or not.
  - `maxCacheAge`: The maximum age of the cached data.

  #### Data Handling

  - `decrypt`: A function to decrypt the received data.
  - `decryptData`: Whether to decrypt the received data or not.
  - `encrypt`: A function to encrypt the available data.
  - `encryptPayload`: Whether to encrypt the payload or not.
  - `initialPayload`: The initial payload to send when connecting.
  - `placeholderData`: The placeholder data to use while loading.
  - `setStateAction`: The reducer to construct the next state.

  #### Logging

  - `log`: The events to log in the console.
  - `logCondition`: A custom condition for logging.

  #### Retrial

  - `retry`: Whether to retry the WebSocket connection or not.
  - `retryDelay`: The delay before retrying the WebSocket connection.
  - `retryCount`: The number of times to retry the WebSocket connection.
  - `reconnectOnNetworkRestore`: Whether to retry the connection when the network is restored.
  - `reconnectOnWindowFocus`: Whether to retry the connection when the window regains focus.
  - `retryBackoffStrategy`: The strategy for increasing the delay between retries (e.g., fixed, exponential).
  - `maxRetryDelay`: The maximum delay between retries.
  - `retryOnSpecificCloseCodes`: An array of specific close codes that should trigger a retry.
  - `retryOnCustomCondition`: A custom function to determine whether to retry based on the error or response.
  - `minJitterValue`: The minimum value for the jitter.
  - `maxJitterValue`: The maximum value for the jitter.
  - `idleConnectionTimeout`: The time to wait before closing an idle connection.

</details>

<details>
  <summary>
    <code>SocketCloseCode</code>: An enum representing the WebSocket close codes.
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

<h1 align="center">@ibnlanre/socket 🚀</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

`@ibnlanre/socket` is a fast, lightweight, type-safe WebSocket client designed to supercharge your developer experience (DX).

With its cache-first approach, it provides a seamless and efficient way to manage WebSocket connections, subscribe to data streams, and handle real-time updates in React applications.

Easily integrate live data streaming into your projects and deliver a superior user experience with `@ibnlanre/socket`.

## Getting Started

To get started with the `@ibnlanre/socket` library, follow these steps:

1. Install the library using npm or yarn.
2. Create a socket client using the `createSocketClient` function.
3. Use the client in your components to subscribe to data streams and handle updates.

## Installation

<details open>
  <summary>
    Using NPM
  </summary>

  ```bash
  npm install @ibnlanre/socket
  ```
</details>

<details open>
  <summary>
    Using Yarn
  </summary>

  ```bash
  yarn add @ibnlanre/socket
  ```
</details>

<details open>
  <summary>
    Using PNPM
  </summary>

  ```bash
  pnpm install @ibnlanre/socket
  ```
</details>

## Configuration

You can configure the socket client by providing the following options:

#### General Configuration

- `baseURL`: The base URL of the WebSocket server.
- `url`: The endpoint URL for the WebSocket connection.
- `enabled`: Whether to enable the WebSocket connection or not.

#### Data Handling Configuration

- `decryptData`: A function to decrypt the received data.
- `encryptPayload`: A function to encrypt the data before sending it.
- `clearCacheOnClose`: Whether to cache the data or not.
- `initialPayload`: The initial payload to send when connecting.
- `placeholderData`: The placeholder data to use while loading.

#### Logging Configuration

- `log`: The events to log in the console.
- `logCondition`: A custom condition for logging.

#### Retrial Configuration

- `retry`: Whether to retry the WebSocket connection or not.
- `retryDelay`: The delay in milliseconds before retrying the WebSocket connection.
- `retryCount`: The number of times to retry the WebSocket connection.
- `reconnectOnNetworkRestore`: Whether to retry the connection when the network is restored.
- `reconnectOnWindowFocus`: Whether to retry the connection when the window regains focus.
- `retryBackoffStrategy`: The strategy for increasing the delay between retries (e.g., fixed, exponential).
- `maxRetryDelay`: The maximum delay in milliseconds between retries.
- `retryOnSpecificCloseCodes`: An array of specific close codes that should trigger a retry.
- `retryOnCustomCondition`: A custom function to determine whether to retry based on the error or response.
- `minJitterValue`: The minimum value for the jitter.
- `maxJitterValue`: The maximum value for the jitter.

## Hooks

`@ibnlanre/socket` provides the following hook to interact with the WebSocket connection and manage data subscriptions in your components.e:

- `use`: Subscribes to a data stream and returns the data, loading state, and error.

### Return Values

#### Hooks

- `subscribe`: Subscribes to data changes and updates the component.
- `on`: Subscribes to a specific WebSocket event.

#### Data

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

#### Actions

- `close`: A function to close the WebSocket connection.
- `open`: A function to open the WebSocket connection.
- `send`: A function to send a message to the WebSocket server.

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

<details open>
  <summary>
    <code>createSocketClient</code>: Creates a socket client with the specified configuration options.
  </summary>

  ### Usage

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
</details>

<details>
  <summary>
    <code>SocketCloseCode</code>: An enum representing the WebSocket close codes.
  </summary>

  ### Usage

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

  ### Usage

  ```tsx
  import { SocketCloseReason, SocketCloseCode } from "@ibnlanre/socket";

  const REASON =  SocketCloseReason[SocketCloseCode.NormalClosure];
  //    ^? "The connection was closed cleanly"
  ```
</details>

<details>
  <summary>
    <code>combineURLs</code>: A function to combine multiple URLs into a single URL.
  </summary>

  ### Usage

  ```tsx
  import { combineURLs } from "@ibnlanre/socket";

  const URL = combineURLs("https://example.com", "/api/v1");
  //    ^? "https://example.com/api/v1"
  ```
</details>

<details>
  <summary>
    <code>getUri</code>: A function to get the URI of the WebSocket connection.
  </summary>

  ### Usage

  ```tsx
  import { getUri } from "@ibnlanre/socket";

  const URI = getUri("wss://example.com", "/ws/v1");
  //    ^? "wss://example.com/ws/v1"
  ```
</details>

<details>
  <summary>
    <code>isAbsoluteURL</code>: A function to check if a URL is absolute or relative.
  </summary>

  ### Usage

  ```tsx
  import { isAbsoluteURL } from "@ibnlanre/socket";

  const IS_ABSOLUTE = isAbsoluteURL("https://example.com");
  //    ^? true
  ```
</details>

<details>
  <summary>
    <code>paramsSerializer</code>: A function to serialize query parameters for a URL.
  </summary>

  ### Usage

  ```tsx
  import { paramsSerializer } from "@ibnlanre/socket";

  const SERIALIZED = paramsSerializer({ page: 1, limit: 10 });
  //    ^? "page=1&limit=10"
  ```
</details>

## Key Features

### Caching Mechanism

One of the standout features of `@ibnlanre/socket` is its caching mechanism. This ensures that previously received data remains available to the user, with background updates enhancing the experience. This makes requests appear blazing fast, as data is readily available while new updates are fetched in the background. 🚀

### Retry Mechanism

`@ibnlanre/socket` also includes a robust retry mechanism that re-establishes the WebSocket connection in case of network issues or server downtime. This is especially useful in real-time applications where a stable connection is crucial for data updates. 🔄

## FAQs

### What is the purpose of `@ibnlanre/socket`?
`@ibnlanre/socket` is designed to facilitate real-time data streaming, making it easier to manage live data updates in your application. By creating a socket client, developers can subscribe to data streams and handle updates efficiently.

### How does `@ibnlanre/socket` work?
`@ibnlanre/socket` creates a socket client using the `createSocketClient` function. This client handles the connection to the WebSocket server, manages data subscriptions, and provides hooks for accessing the streamed data in your components.

### What are the key features of `@ibnlanre/socket`?
Key features include data caching, real-time data streaming, easy subscription management, efficient data handling, flexible configuration, and type safety. These features make it easier to integrate live data updates into your application, improving user experience and responsiveness.

## License

`@ibnlanre/socket` is licensed under the [BSD-3][bsd-3] License. For more information, please refer to the [LICENSE][license] file.

[license]: LICENSE
[bsd-3]: https://opensource.org/license/bsd-3-clause

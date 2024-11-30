<h1 align="center">@ibnlanre/socket ✨</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

## Getting Started

To get started with the `@ibnlanre/socket` library, follow these steps:

1. Install the library using npm or yarn.
2. Create a socket client using the `createSocketClient` function.
3. Use the client in your components to subscribe to data streams and handle updates.

## Installation

```bash
npm install @ibnlanre/socket
```

## Configuration

You can configure the socket client by providing the following options:

### General Configuration

- `baseURL`: The base URL of the WebSocket server.
- `url`: The endpoint URL for the WebSocket connection.
- `decryptData`: A function to decrypt the received data.
- `encryptPayload`: A function to encrypt the data before sending it.
- `enabled`: Whether to enable the WebSocket connection or not.
- `log`: The events to log in the console.
- `logCondition`: A custom condition for logging.
- `clearCacheOnClose`: Whether to cache the data or not.

### Retrial Configuration

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
        participant_count: string;
        traded_volume_kg: string;
        traded_volume_mt: string;
        listed_contracts: string;
        boards: Array<{
          name: string;
          code: string;
          description: string;
          order_types: Array<any>;
          security_count: string;
        }>;
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
  decryptData: decrypt,
  retry: true,
  retryDelay: 2000,
  retryCount: 5,
  reconnectOnNetworkRestore: true,
  reconnectOnWindowFocus: true,
  retryBackoffStrategy: "exponential",
  maxRetryDelay: 60000,
  retryOnSpecificCloseCodes: [SocketCloseCode.AbnormalClosure],
  retryOnCustomCondition: (event, socket) => {
    return event.code === SocketCloseCode.PROTOCOL_ERROR
  },
  minJitterValue: 0.9,
  maxJitterValue: 1.1,
});

export function App() {
  const {
    data,
    isPending,
  } = client.use({ currency: "USD" }, (data) => {
    if (!data) return;
    return data.notifications.summary.notifications;
  });

  if (isPending) return <div>Loading...</div>;

  return (
    <div>
      <h1>Stock Market Overview</h1>
      <p>Total Securities: {data?.totalSecurities}</p>
      <p>Participant Count: {data?.participantCount}</p>
      <p>Traded Volume (Kg): {data?.tradedVolumeKg}</p>
      <p>Traded Volume (Mt): {data?.tradedVolumeMt}</p>
      <p>Listed Contracts: {data?.listedContracts}</p>
      <p>Boards: {data?.boards.map((board) => board.name).join(", ")}</p>
    </div>
  );
}
```

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
Key features include real-time data streaming, easy subscription management, efficient data handling, flexible configuration, and type safety. These features make it easier to integrate live data updates into your application, improving user experience and responsiveness.

### How can I customize the socket client with `@ibnlanre/socket`?
You can customize the socket client by providing configuration options such as the base URL, endpoint URL, and more. These options allow you to tailor the client to your specific use case and data requirements.

### Does `@ibnlanre/socket` support caching?
Yes, `@ibnlanre/socket` supports caching. You can configure the client to cache data and clear the cache when the connection is closed. This feature helps reduce the load on the server and improve the performance of your application.

## License

`@ibnlanre/socket` is licensed under the [BSD-3][bsd-3] License. For more information, please refer to the [LICENSE][license] file.

[license]: LICENSE
[bsd-3]: https://opensource.org/license/bsd-3-clause

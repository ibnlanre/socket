<h1 align="center">@ibnlanre/socket ✨</h1>

<div align="center">

[![minified size](https://img.shields.io/bundlephobia/min/@ibnlanre/socket)](https://bundlephobia.com/package/@ibnlanre/socket)
[![license](https://img.shields.io/github/license/ibnlanre/socket?label=license)](https://github.com/ibnlanre/socket/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)
[![downloads](https://img.shields.io/npm/dt/@ibnlanre/socket)](https://www.npmjs.com/package/@ibnlanre/socket)

</div>

## Installation

```bash
npm install @ibnlanre/socket
```

## Usage

```tsx
type stock_market_overview = {
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

## FAQs

### What is the purpose of the @ibnlanre/socket library?
The @ibnlanre/socket library is designed to facilitate real-time data streaming, making it easier to manage live data updates in your application. By creating a socket client, developers can subscribe to data streams and handle updates efficiently.

### How does the @ibnlanre/socket library work?
The @ibnlanre/socket library creates a socket client using the createSocketClient function. This client handles the connection to the WebSocket server, manages data subscriptions, and provides hooks for accessing the streamed data in your components.

### What are the key features of the @ibnlanre/socket library?
The key features of the @ibnlanre/socket library include real-time data streaming, easy subscription management, efficient data handling, flexible configuration, and type safety. These features make it easier to integrate live data updates into your application, improving user experience and responsiveness.

### How can I customize the socket client with the @ibnlanre/socket library?
You can customize the socket client with the @ibnlanre/socket library by providing configuration options such as the base URL, endpoint URL, and data decryption function. These options allow you to tailor the client to your specific use case and data requirements.

## License

The `@ibnlanre/builder` library is licensed under the [BSD-3][bsd-3] License. For more information, please refer to the [LICENSE][license] file.

[license]: LICENSE.md
[bsd-3]: https://www.mit.edu/about

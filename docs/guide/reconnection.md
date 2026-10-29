# Reconnection

`Socket` and `EventSourceClient` share a common `ReconnectionPolicy` for automatic retries. `Socket` defaults to **exponential** backoff; `EventSourceClient` defaults to **fixed**.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `retry` | `false` | Master switch for automatic reconnects |
| `retryCount` | `3` | Max attempts (`0` = never retry, `Infinity` = retry forever) |
| `retryDelay` | `"5 seconds"` | Base delay between attempts |
| `retryBackoffStrategy` | `"exponential"` (Socket) / `"fixed"` (ES) | Delay growth strategy |
| `maxRetryDelay` | `"1 minute"` | Cap on the backoff delay |
| `minJitterValue` | `0.8` | Lower bound of the jitter multiplier |
| `maxJitterValue` | `1.2` | Upper bound of the jitter multiplier |

### Duration format

Durations accept a raw number (milliseconds) or strings like `"5 seconds"`, `"2m"`, `"30 s"` — with singular, plural, and abbreviated units (`ms`, `s`, `m`, `h`, `d`, `w`, `mo`, `y` and their variants).

## Backoff math (Socket, exponential)

```
delay        = min(retryDelay * 2^failureCount, maxRetryDelay)
jitterFactor = minJitterValue + random() * (maxJitterValue - minJitterValue)
backoff      = delay * jitterFactor
```

### When the count resets

`failureCount` returns to `0` once a connection proves healthy: when it delivers its first message, or when it has stayed open for `maxRetryDelay`. Opening is not enough. A server that accepts the handshake and then drops the connection keeps counting failures, so the backoff grows and `retryCount` still ends the attempts.

## Retry decision

A reconnect is scheduled only when **all** of these hold:

1. `retry` is `true`, **and**
2. `failureCount < retryCount`, **and**
3. `retryOnCustomCondition` returns `true` **or** the close code is in `retryOnSpecificCloseCodes`.

```tsx
import { SocketClient, SocketCloseCode } from "@ibnlanre/socket";

const client = new SocketClient({
  baseURL: "wss://example.com",
  url: "/prices",
  retry: true,
  retryDelay: 2000,
  minJitterValue: 0.9,
  retryCount: 5,
  retryOnSpecificCloseCodes: [
    SocketCloseCode.ABNORMAL_CLOSURE, // 1006
    SocketCloseCode.SERVICE_RESTART,  // 1012
    SocketCloseCode.TRY_AGAIN_LATER,  // 1013
  ],
  retryOnCustomCondition: (event, socket) => {
    return event.code === SocketCloseCode.PROTOCOL_ERROR;
  },
});
```

### Default retry codes

By default, `Socket` retries on `[1006, 1012, 1013]` — `ABNORMAL_CLOSURE`, `SERVICE_RESTART`, and `TRY_AGAIN_LATER`. Because `SocketCode` accepts `number & {}`, you can supply any numeric close code, not just the enum members.

## Environment-driven reconnects

These reconnect a socket even after retries would normally be exhausted:

| Option | Default | Behavior |
| --- | --- | --- |
| `reconnectOnNetworkRestore` | `true` | Reconnect on `window` `"online"` |
| `reconnectOnWindowFocus` | `true` | Reconnect when the window regains `focus` |
| `reconnectOnPageRestore` | `true` | **bfcache**: close cleanly on `pagehide` so the browser can cache the page, reopen on `pageshow` when `event.persisted` |

## State during reconnect

- While a retry is scheduled, `fetchStatus` becomes `"disconnected"`.
- If a cached value exists, `status` stays/becomes `"stale"` so the UI can keep rendering data.
- When retries are exhausted on an unclean close, terminal failure metadata (`failureReason`, `failureCount`) is recorded and the socket settles into `"error"`.

## Pacing handshakes

Some servers, and the proxies before them, take connections one after another well but stall or drop several begun together, as a page opening all its feeds at once begins them, and then every retry adds to the crowd. A `SocketGate` paces them: no more than `concurrency` handshakes at once to any one server (origin), the rest queued in order.

```ts
const gate = new SocketGate({ concurrency: 1 });

const prices = new SocketClient({ url: "wss://feeds.example.com/prices", gate });
const orders = new SocketClient({ url: "wss://feeds.example.com/orders", gate });
```

A turn lasts from just before the transport is created until the handshake opens, closes or errors, or `timeout` passes (default 10 seconds, so a server that never answers cannot hold the queue). Retries wait their turn like any other attempt. While it waits, a socket reports `fetchStatus: "preparing"`. Sockets to different servers never wait on each other, unless `lane` says otherwise: it maps a URL to its queue (by default its origin). Where several hosts sit behind one proxy, give them one lane, so their handshakes are paced together:

```ts
const gate = new SocketGate({ lane: () => "edge-proxy" });
```

## When retries run out

A socket that has stopped after a failure it will not retry reports `isExhausted: true`. It stays closed, its error and failure count kept, until `open()` starts it again, so an app can offer "reconnect" rather than keep calling a server that is struggling.

Across many sockets, a client knows which of its own have stopped and are still read (`client.exhausted()`), and tells listeners when that changes (`client.subscribe()`). `useExhaustedSockets` counts them across several clients for one notice, and reopens them one after another, `stagger` apart, so a recovering server is not met with every handshake at once:

```tsx
const network = useExhaustedSockets([prices, orders], { stagger: "400 milliseconds" });

if (network.count) {
  return (
    <p>
      Live updates have stopped.{" "}
      <button disabled={network.isReconnecting} onClick={network.reconnect}>
        Reconnect
      </button>
    </p>
  );
}
```

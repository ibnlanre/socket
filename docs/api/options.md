# Options

The `SocketClient` / `Socket` constructor configuration (`SocketConstructor`) is composed of several option groups plus its own fields. All options are optional except `url`.

## Core

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `string` | — (required) | The endpoint path/URL for the connection |
| `baseURL` | `string` | `""` | Base URL prepended to `url` |
| `binaryType` | `"blob" \| "arraybuffer"` | `"blob"` | Preferred binary frame representation |
| `protocols` | `SocketProtocolIdentifier \| SocketProtocolIdentifier[]` | `[]` | Subprotocols for the WebSocket handshake (accepts IANA names or arbitrary strings) |
| `messageSchema` | `SocketSchema<unknown, Get>` | — | Validates/transforms inbound messages after `JSON.parse` (async OK) |
| `paramsSchema` | `SocketSchema<ParamsInput, Params>` | — | Validates/transforms URL params; async via `prepare()` |
| `sendSchema` | `SocketSchema<Post, unknown>` | — | Validates/transforms outbound payloads; async via `sendAsync()` |

## Cache options

| Option | Default | Description |
| --- | --- | --- |
| `cacheKey` | origin of the URL | Cache name to use |
| `maxCacheAge` | `"15 minutes"` | Entry lifetime before expiry |
| `clearCacheOnClose` | `false` | Clear the cache when the socket closes |
| `disableCache` | `false` | Skip Cache API reads and writes (keep in-memory mirror) |

## Data handling

| Option | Default | Description |
| --- | --- | --- |
| `deduplicationWindow` | `0` (disabled) | Collapse identical outbound payloads within this window |
| `placeholderData` | `undefined` | Value surfaced before the first real message |
| `setStateAction` | identity | `(nextState, currentState?) => State` reducer for stored state |
| `encrypt` / `decrypt` | `undefined` | `SocketCipher = (data) => unknown` applied on write / read |
| `encryptPayload` | `true` | Encrypt the serialized payload on write |
| `decryptData` | `true` | Decrypt data on read |
| `messageFailurePolicy` | see below | Per-stage action for message processing failures |

### `messageFailurePolicy`

```ts
type SocketMessageFailureAction = "recover" | "close";
type SocketMessageFailurePolicy = {
  decode: SocketMessageFailureAction;
  parse: SocketMessageFailureAction;
  validation: SocketMessageFailureAction;
};
```

Default: `{ decode: "close", parse: "recover", validation: "recover" }`.

Each stage runs after the previous succeeds: **decode** (frame → text), **parse** (`JSON.parse`), **validation** (`messageSchema`).

- `"recover"` — drop the offending message and keep the connection alive.
- `"close"` — terminate the socket, recording terminal failure metadata (`failureReason`, `failureCount + 1`, close code). Failures carry local classifications `1008` (`POLICY_VIOLATION`) for validation and `1007` (`INVALID_PAYLOAD_DATA`) for decode/parse. The browser transport is closed normally; these reserved codes are not passed to `WebSocket.close()`.

## Outgoing queue

Sends route through an ordered, bounded outbox shared by `send()` and `sendAsync()`. Waiting payloads flush in order on `open`.

| Option | Default | Description |
| --- | --- | --- |
| `maxQueueSize` | `1000` | Maximum waiting sends (including async validation) |
| `queueMaxAge` | `"1 minute"` | Maximum age of a waiting send before it is expired |
| `queueOverflow` | `"reject"` | Full-queue behavior: `"reject"` throws; `"drop-oldest"` drops the oldest waiting send |
| `maxBufferedAmount` | `1048576` | Bytes already buffered by the browser beyond which dispatch pauses |
| `maxPendingMessages` | `1000` | Maximum in-flight incoming validations before the connection is closed |
| `maxDeduplicationEntries` | `1000` | Maximum retained deduplication keys |

When `deduplicationWindow` is `0`, deduplication is disabled and repeated sends remain distinct, subject to queue limits. When greater than `0`, identical payloads within the window collapse to one wire message and dedup history is bounded by `maxDeduplicationEntries`.

## Connection preparation & diagnostics

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `prepareConnection` | `SocketPrepareConnection` | — | Runs before every transport attempt (e.g. auth/token refresh). Returning `{ url, protocols }` overrides that attempt only; pool and cache identity are unchanged. |
| `onDiagnostic` | `(event: SocketDiagnostic) => void` | — | Receives structured `connection` / `retry` / `queue` / `validation` / `cache` events. Events do not directly include payloads or URLs; validation errors may include details from the schema. |

On `SocketClient`, `maxPoolSize` (default `1000`) bounds the number of pooled sockets; exceeding it throws a `RangeError` rather than silently evicting.

## Reconnection

`Socket`'s reconnection options extend the shared `ReconnectionPolicy` and add environment-driven reconnect triggers.

| Option | Default | Description |
| --- | --- | --- |
| `retry` | `false` | Master switch for automatic reconnects |
| `retryCount` | `3` | Max attempts (`0` never, `Infinity` forever) |
| `retryDelay` | `"5 seconds"` | Base delay between attempts |
| `retryBackoffStrategy` | `"exponential"` on `Socket`, `"fixed"` on `EventSourceClient` | Delay growth |
| `maxRetryDelay` | `"1 minute"` | Backoff cap |
| `minJitterValue` / `maxJitterValue` | `0.8` / `1.2` | Jitter multiplier bounds |
| `retryOnSpecificCloseCodes` | `[1006, 1012, 1013]` | Close codes that trigger a retry |
| `retryOnCustomCondition` | `undefined` | `(event: CloseEvent, socket: WebSocket) => boolean` |
| `reconnectOnNetworkRestore` | `true` | Reconnect on `window` `"online"` |
| `reconnectOnWindowFocus` | `true` | Reconnect on window `focus` |
| `reconnectOnPageRestore` | `true` | bfcache: close on `pagehide`, reopen on persisted `pageshow` |
| `idleConnectionTimeout` | `"5 minutes"` | Close after the last subscriber unsubscribes |

See [Guide → Reconnection](/guide/reconnection) for the retry decision logic and backoff math.

## Logging

| Option | Default | Description |
| --- | --- | --- |
| `log` | `["open", "close", "error"]` | Which connection events to log (message excluded by default) |
| `logCondition` | `() => NODE_ENV === "development"` | Predicate controlling whether a log line is emitted |

### Preparing fresh credentials

```ts
prepareConnection: async ({ url, signal }) => {
  const response = await fetch("/api/socket-token", { signal });
  if (!response.ok) throw new Error("Could not prepare socket credentials");
  const { token } = await response.json();
  const target = new URL(url);
  target.searchParams.set("token", token);
  return { url: target.href };
}
```

Closing aborts preparation and discards a late result. Preparation errors follow retry count/delay when retry is enabled. Include stable account or tenant identity in subscription parameters when data must be isolated: per-attempt authentication does not change the pool/cache key.

Queue expiry and browser-buffer availability are checked on a short timer. `maxBufferedAmount` controls pressure before a send, not maximum individual frame size. A `sent` diagnostic means handed to the browser transport, not acknowledged by the server. Diagnostic callback exceptions do not alter connection behavior.

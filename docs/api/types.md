# Types & constants

This page summarizes the exported types, unions, and constants from the package entry.

## Public exports

**Values**

```ts
EventSourceClient, Socket, SocketCache, SocketClient,
SocketCloseCode, SocketCloseReason
```

**Types**

```ts
EventSourceClientOptions, EventSourceListener, EventSourceStatus,
SocketCacheOptions, SocketClientConstructor, SocketCommands, SocketConnectionEvent,
SocketConnectionPreparation, SocketConstructor, SocketPrepareConnection,
SocketMessageFailureAction, SocketMessageFailurePolicy, SocketFetchStatus,
InferSocketSchema, SocketListener, UseSocketOptions, SocketParamsSerializer,
SocketQueueOptions, SocketReconnectOptions, SocketSchema, SocketSelector,
SocketState, SocketStatus, SocketTimeout, SocketURI, TimeUnit, Unit, UnitValue,
UseSocketResult, PreparedParams, SocketDiagnostic
```

## Status unions

### `SocketStatus`

```ts
type SocketStatus = "idle" | "stale" | "loading" | "success" | "error";
```

### `SocketFetchStatus`

```ts
type SocketFetchStatus = "idle" | "connecting" | "connected" | "disconnected";
```

### `EventSourceStatus`

```ts
type EventSourceStatus = "idle" | "connecting" | "open" | "error";
```

### `SocketConnectionEvent`

```ts
type SocketConnectionEvent = "open" | "message" | "close" | "error";
```

## `UseSocketResult`

```ts
interface UseSocketResult<Get = unknown, Post = never, State = Get>
  extends SocketState<Get>, SocketCommands<Post>
{
  /** The latest selected data from the socket. */
  readonly data: State;
}
```

`useSocket` returns read-only `SocketState` fields + `SocketCommands` + the selected `data`. Because it is composed by interface extension (not `Pick`/`Omit`), it can never drift from `Socket`.

## `SocketState` / `SocketCommands`

```ts
interface SocketState<Get> {
  readonly binaryType: "blob" | "arraybuffer";
  readonly dataUpdatedAt: number;
  readonly error: Error | null;
  readonly errorUpdatedAt: number;
  readonly failureCount: number;
  readonly failureReason: string | null;
  readonly fetchStatus: SocketFetchStatus;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isDisconnected: boolean;
  readonly isError: boolean;
  readonly isIdle: boolean;
  readonly isLoading: boolean;
  readonly isPending: boolean;
  readonly isPlaceholderData: boolean;
  readonly isRefetchError: boolean;
  readonly isRefetching: boolean;
  readonly isStaleData: boolean;
  readonly isSuccess: boolean;
  readonly status: SocketStatus;
  readonly value: Get | undefined;
}

interface SocketCommands<Post> {
  close: () => void;
  on: SocketListener;
  open: () => void;
  send: (payload: Post) => boolean;
  sendAsync: (payload: Post, options?: { signal?: AbortSignal }) => Promise<boolean>;
  waitUntil: (state: SocketConnectionEvent, timeout?: UnitValue) => Promise<void>;
}
```

## Schema & selector types

```ts
// Any Standard Schema V1 implementation (Zod, Valibot, ArkType, …)
// Output defaults to Input; a schema may transform between the two.
type SocketSchema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output>;

// Output type inference from a schema
type InferSocketSchema<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>;

// select signature
type SocketSelector<Get, State> = (data: Get | undefined) => State;

// custom params serializer
type SocketParamsSerializer = (params: ConnectionParams) => string;
```

## Supporting types

```ts
type ConnectionParams = Record<string, ParamValue>;
type ParamValue = PrimitiveType | PrimitiveType[];
type PrimitiveType = string | number | boolean | null | undefined;

type SocketCipher = <Data>(data: Data) => unknown;
type SocketURI = { url: string; baseURL?: string; params?: ConnectionParams };
type SocketData = MessageEvent<string | Blob | ArrayBuffer>;
type SocketTimeout = ReturnType<typeof setTimeout> | number | undefined;
```

## Prepared params

```ts
interface PreparedParams<Params> {
  readonly params: Readonly<Params>;
  readonly key: string; // fully resolved pool key / connection URL
}
```

## Queue & diagnostics

`SocketQueueOptions` bounds the ordered send queue (see [Reference → Options](/api/options)); `SocketDiagnostic` is the structured event shape passed to `onDiagnostic`:

```ts
type SocketDiagnostic =
  | { type: "connection"; phase: "preparing" | "connecting" | "open" | "closed"; timestamp: number }
  | { type: "retry"; attempt: number; delay: number; timestamp: number }
  | { type: "queue"; size: number; action: "queued" | "sent" | "expired" | "dropped" | "deduplicated"; timestamp: number }
  | { type: "validation"; direction: "incoming" | "outgoing"; error: Error; timestamp: number }
  | { type: "cache"; action: "hit" | "error"; error?: Error; timestamp: number };
```

## Time units

`UnitValue` accepts a raw number (milliseconds) or strings like `"5 seconds"`, `"2m"`, `"500 ms"`. Units support singular, plural, and abbreviated forms (`ms`, `s`, `m`, `h`, `d`, `w`, `mo`, `y` and variants), plus `Capitalize`/`Uppercase` casing:

```ts
type UnitValue = number | `${number} ${Unit}` | `${number}${Unit}`;
```

## `SocketCloseCode`

A frozen map of the standard WebSocket close codes. Several keys are deliberate aliases of the same number.

| Key | Value | Key | Value |
| --- | --- | --- | --- |
| `NORMAL_CLOSURE` | 1000 | `NO_STATUS_RECEIVED` / `EMPTY` | 1005 |
| `GOING_AWAY` / `ENDPOINT_UNAVAILABLE` | 1001 | `ABNORMAL_CLOSURE` | 1006 |
| `PROTOCOL_ERROR` | 1002 | `INVALID_PAYLOAD_DATA` | 1007 |
| `UNSUPPORTED_DATA` / `INVALID_MESSAGE_TYPE` | 1003 | `POLICY_VIOLATION` | 1008 |
| `RESERVED` | 1004 | `MESSAGE_TOO_BIG` | 1009 |
| `MANDATORY_EXTENSION` | 1010 | `SERVICE_RESTART` | 1012 |
| `INTERNAL_SERVER_ERROR` | 1011 | `TRY_AGAIN_LATER` | 1013 |
| `BAD_GATEWAY` | 1014 | `TLS_HANDSHAKE_FAIL` | 1015 |

```ts
const code = SocketCloseCode.ABNORMAL_CLOSURE; // 1006
```

`SocketCloseReason` maps each code to a human-readable string (used as the WebSocket close `reason`). `SocketCode = SocketCloseCode | (number & {})` allows any numeric close code in retry arrays.

## Internal (not re-exported)

`ConnectionParams`, `ReconnectionPolicy`, `SocketCipher`, `SocketData`, `SocketSubscriber`, `SocketSetStateAction`, `Socks`, the event-source internals (`Init`, `MethodInit`, `HeadersInit`), and the low-level utility types appear in signatures but are not exported from the entry point.

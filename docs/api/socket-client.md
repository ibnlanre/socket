# `SocketClient`

The React hook host + **pool** of shared [`Socket`](/api/socket) instances for one WebSocket endpoint.

```ts
class SocketClient<Get = unknown, Post = never, Params extends ConnectionParams = never> {
  constructor(configuration: SocketConstructor<Get, Post, Params>);
}
```

## Type parameters

| Param | Meaning |
| --- | --- |
| `Get` | The parsed message type (`value`). Default `unknown`. |
| `Post` | The accepted send payload type. Default `never`. |
| `Params` | The params object type. Default `never`, must extend `ConnectionParams` (`Record<string, ParamValue>`). |

Types are set **explicitly** — they are not inferred from the schemas.

## Methods

### `get(params?)`

Returns the pooled [`Socket`](/api/socket) for the given params — creating one if needed.

```ts
get(params?: Params): Socket<Get, Post, Params>;
```

Identical params ⇒ the same `Socket` instance (see [Socket pooling](/guide/socket-pooling)).

```ts
const socket = client.get({ room: "general" });
socket.open();
```

### `useSocket(options?)`

The **only** React hook (there is no deprecated alias). Subscribes to the pooled socket, opens it when `enabled` (default `true`), and returns a reactive result.

```ts
useSocket<State = Get>(
  options?: UseSocketOptions<Get, State, Params>,
): UseSocketResult<Get, Post, State>;
```

`UseSocketOptions`:

```ts
type UseSocketOptions<Get = unknown, State = Get, Params extends ConnectionParams = never> = {
  params?: Params;                 // URL params for the connection
  enabled?: boolean;               // open when true (default true)
  select?: (data: Get | undefined) => State; // defaults to identity
};
```

```tsx
const socket = client.useSocket({
  params: { room: "general" },
  enabled: isLoggedIn,
  select: (message) => message ?? null,
});
```

Notes:

- `data` is `select(value)` and is memoized on `[value, select]`.
- If the pooled socket changes between renders (e.g. `params` change), the snapshot is reset **during render** so old state never mixes with the new socket's commands.
- The returned commands are bound to the pooled `Socket` — components sharing a socket get identical `send`/`on`/`open`/`close`/`waitUntil` references.

### `close(params?)`

Closes the pooled socket for `params`, clears its cache, and removes it from the pool.

```ts
close(params?: Params): boolean; // false when no such socket exists
```

### `closeAll()`

Closes every pooled socket and returns the number closed.

```ts
closeAll(): number;
```

## Example

```tsx
import { SocketClient } from "@ibnlanre/socket";

const chatClient = new SocketClient({
  baseURL: "wss://chat.example.com",
  url: "/ws",
});

function ChatRoom({ room }: { room: string }) {
  const socket = chatClient.useSocket({ params: { room } });
  return <p>{socket.status}: {socket.data ?? "no message yet"}</p>;
}
```

## Return type

`useSocket` returns a [`UseSocketResult`](/api/types#usesocketresult) — read-only [`SocketState`](/api/socket#state-getters) + [`SocketCommands`](/api/socket#commands) + `data`. See [Reference → Types & constants](/api/types).

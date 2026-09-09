# Validation

Socket uses Standard Schema V1 for runtime validation and type inference. Schemas may validate synchronously or asynchronously through the same API.

| Schema | Input | Output is used for |
| --- | --- | --- |
| `paramsSchema` | Subscription parameters | Pool identity and connection URL |
| `sendSchema` | Payload passed to `send` | Outbound JSON frame |
| `messageSchema` | Decoded, parsed frame | Received data |

## Parameters define identity

`get` awaits validation before looking up the pool. The normalized result drives both the pool key and the connection URL. A transform can therefore make different inputs share one connection.

```tsx
import { SocketClient } from "@ibnlanre/socket";
import { z } from "zod";

const client = new SocketClient({
  baseURL: "wss://example.com",
  url: "/rooms",
  paramsSchema: z.string().transform(async (room) => ({
    room: room.trim().toLowerCase(),
  })),
});

function Room({ name }: { name: string }) {
  const socket = client.useSocket({ params: name });
  if (socket.isPreparing) return <p>Preparing room…</p>;
  if (socket.isError) return <p>{socket.error?.message}</p>;
  return <pre>{JSON.stringify(socket.data)}</pre>;
}

// Imperative use follows the same resolution path.
const socket = await client.get("GENERAL");
socket.open();
```

The hook owns preparation, cancellation, and subscription. It starts no validation while disabled. When parameters change or the component unmounts, its previous wait is cancelled and stale results are ignored.

Concurrent resolutions of the same JSON-serializable input share validation. Aborting one caller does not cancel another caller's wait. Standard Schema validators do not receive an abort signal, so underlying work may continue; a cancelled caller cannot create a socket. `client.clear()` invalidates all pending resolutions.

Use [connection preparation](/api/options#connection-preparation-diagnostics) for credentials refreshed on every reconnect. Stable subscription parameters identify the stream; refreshed credentials authorize its transport.

## Outgoing payloads

`await socket.send(payload)` awaits validation and accepts the transformed JSON value into the ordered queue. It resolves `true` on local acceptance or `false` on deduplication. It does not acknowledge server receipt.

```ts
const client = new SocketClient({
  url: "wss://example.com/messages",
  sendSchema: z.string().min(1).transform(async (content) => ({ content })),
});

const socket = await client.get();
socket.open();
try {
  await socket.send("Hello");
} catch (error) {
  console.error("Message was not accepted", error);
}
```

Validation errors include `closeCode: 1008` and `stage: "validation"`. Queue overflow, expiry, cancellation, and invalid JSON can also reject a pending send. A send reserves its queue position before validation, so later messages cannot pass a slower earlier validation. See [Sending messages](/guide/sending).

## Incoming messages

`messageSchema` runs after decoding and JSON parsing. WebSocket and both SSE transports process messages in arrival order. Closing or replacing a connection invalidates its pending processing, preventing stale work from updating the new connection.

Validated WebSocket messages become `value` with `status: "success"`. Invalid messages follow the configured [message failure policy](/api/options#messagefailurepolicy): recover by dropping the message, or close the connection.

## Type inference and transforms

`SocketSchema<Input, Output>` allows different input and output types. For `SocketClient<Get, Post, Params, ParamsInput>`:

- `Get` is the validated message output.
- `Post` is the accepted send input, defaulting to `never`.
- `Params` is the normalized query object.
- `ParamsInput` is the input accepted before parameter validation.

Compatible schemas infer these types; explicit generics remain available. Keep WebSocket message output JSON-compatible: the cache path serializes validated values through JSON, so values such as `Date` do not preserve runtime identity.

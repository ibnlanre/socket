# Validation

The library uses **Standard Schema V1** for all runtime validation. Any schema implementing the `~standard` interface works — Zod, Valibot, ArkType, and others. Schemas are optional, but when present they validate at runtime **and** infer TypeScript types.

There are three schema slots, each with a distinct job:

| Schema | Validates | Where used | Async? |
| --- | --- | --- | --- |
| `paramsSchema` | URL params | Builds the pool key & connection URL | ❌ sync only |
| `sendSchema` | Outbound payloads | `socket.send(payload)` | ❌ sync only |
| `messageSchema` | Inbound messages | After `JSON.parse` | ✅ async OK |

::: warning Async constraint
`paramsSchema` and `sendSchema` must be **synchronous** Standard Schemas. If their `~standard.validate` returns a Promise, the library throws a `TypeError`. `messageSchema` may be async.
:::

## Params

`paramsSchema` validates and **transforms** the params object. The validated value is what gets URL-serialized and used as the pool key — so distinct inputs that normalize to the same output share a socket.

```tsx
import { z } from "zod";

const paramsSchema = z.object({
  room: z.string(),
  token: z.string().optional(),
});

const client = new SocketClient({
  baseURL: "wss://chat.example.com",
  url: "/ws",
  paramsSchema,
});

client.useSocket({ params: { room: "general" } });
```

## Outgoing payloads

`sendSchema` validates (and can transform) what you pass to `send`. On sync failure the library throws an error carrying `closeCode: SocketCloseCode.POLICY_VIOLATION` (`1008`) and `stage: "validation"`.

```tsx
const sendSchema = z.object({
  type: z.literal("message"),
  content: z.string().min(1),
});

socket.send({ type: "message", content: "hi" }); // ok
socket.send({ type: "message", content: "" });   // throws validation error
```

## Incoming messages

`messageSchema` runs after the frame is decoded and `JSON.parse`d. It may be async (e.g. Zod's `.promise()` or async refinements). How a failure is handled depends on the [message failure policy](/api/options#messagefailurepolicy):

- a validated message becomes the socket's `value` with `status: "success"`;
- an invalid message follows the configured per-stage action (`"recover"` drops it, `"close"` terminates the socket).

```tsx
const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("price"), symbol: z.string(), price: z.number() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
```

## Type inference

Types are set **explicitly** on the client generic parameters — the library does not infer them from the schemas:

```ts
// Infer message types from a Zod schema
type PriceMessage = z.infer<typeof messageSchema>;

new SocketClient<PriceMessage>({ url: "/prices", messageSchema });
```

The full signature is `SocketClient<Get, Post, Params>` where:

- `Get` — the parsed message type (`value`).
- `Post` — the accepted send payload type (default `never`).
- `Params` — the params object type (default `never`, must extend `ConnectionParams`).

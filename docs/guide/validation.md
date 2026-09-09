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

`paramsSchema` validates parameters when the client looks up a socket.

::: warning Parameter transforms
Currently, schema output is used to construct the pool key, but the socket receives the original parameters for its connection URL. Normalize parameters before passing them to the client, and use `paramsSchema` for validation without transforms until these paths are aligned.
:::

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

`messageSchema` runs after the frame is decoded and `JSON.parse`d. It may be async, for example through an asynchronous refinement. How a failure is handled depends on the [message failure policy](/api/options#messagefailurepolicy):

- a validated message becomes the socket's `value` with `status: "success"`;
- an invalid message follows the configured per-stage action (`"recover"` drops it, `"close"` terminates the socket).

```tsx
const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("price"), symbol: z.string(), price: z.number() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
```

## Type inference

TypeScript can infer client generic parameters from compatible schemas. You can also supply them explicitly, particularly when no schema is provided:

```ts
// Infer message types from a Zod schema
type PriceMessage = z.infer<typeof messageSchema>;

new SocketClient<PriceMessage>({ url: "/prices", messageSchema });
```

The full signature is `SocketClient<Get, Post, Params>` where:

- `Get` — the parsed message type (`value`).
- `Post` — the accepted send payload type (default `never`).
- `Params` — the params object type (default `never`, must extend `ConnectionParams`).

## Async validation and connection identity

Incoming WebSocket messages and both SSE transports accept asynchronous message validation. `send` and client lookup remain synchronous: `send` returns a boolean, while `get` immediately returns a pooled socket. Returning a Promise from their schemas throws rather than changing those contracts.

For asynchronous parameter preparation, finish the work before passing parameters to `get` or mounting a component that calls `useSocket`. Keep the client’s parameter schema synchronous. Setting `enabled: false` prevents the hook from opening a connection; it does not skip parameter validation or pool lookup.

Async incoming validation currently runs independently for WebSocket frames and native SSE events. A slower earlier message may finish after a newer one. Prefer synchronous validation when arrival order matters until ordered processing is available.

## Transform boundaries

The current `SocketSchema<T>` uses the same type for schema input and output. Same-type transforms are easier to express than transforms that change the type. Explicit generic arguments do not remove that limitation.

WebSocket message output is also serialized through JSON before entering the cache. Keep transformed values JSON-compatible; objects such as `Date` do not retain their runtime identity through this path.

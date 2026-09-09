# Validation

The library uses **Standard Schema V1** for all runtime validation. Any schema implementing the `~standard` interface works — Zod, Valibot, ArkType, and others. Schemas are optional, but when present they validate at runtime **and** infer TypeScript types.

There are three schema slots, each with a distinct job:

| Schema | Validates | Where used | Async? |
| --- | --- | --- | --- |
| `paramsSchema` | URL params | Pool identity + connection URL | ✅ via `prepare()`; sync for render-time lookup |
| `sendSchema` | Outbound payloads | `send()` / `sendAsync()` | ✅ async via `sendAsync()` |
| `messageSchema` | Inbound messages | After `JSON.parse` | ✅ async OK |

The synchronous entry points keep their contracts — `send()` returns a boolean and render-time lookup (`get`, `useSocket`) returns a socket immediately. Where validation is asynchronous it lives on the matching async API: `sendAsync()` for sends and `prepare()` / `getAsync()` / `usePreparedParams` for parameters.

## Params

`paramsSchema` validates — and can transform — parameters when the client resolves a socket. Parameters are validated and normalized **once**, and that exact result drives both sides of identity: the pool key **and** the connection URL. A schema transform therefore decides which socket and URL are used, so normalize deliberately.

Render-time lookup stays synchronous. It accepts either plain params (validated synchronously) or an already-**prepared** value (see below). For asynchronous parameter validation — use `prepare()` and pass the result to `get`/`useSocket`, or use the `usePreparedParams` hook:

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

`sendSchema` validates (and can transform) what you pass to `send` — synchronously. On failure the library throws an error carrying `closeCode: SocketCloseCode.POLICY_VIOLATION` (`1008`) and `stage: "validation"`.

When your `sendSchema` is asynchronous, use `sendAsync(payload, { signal })` instead: it validates, then accepts the payload into the ordered send queue.

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

The full signature is `SocketClient<Get, Post, Params, ParamsInput>` where:

- `Get` — the parsed message type (`value`).
- `Post` — the accepted send payload type (default `never`).
- `Params` — the normalized params type (default `never`, must extend `ConnectionParams`).
- `ParamsInput` — the accepted input params type before validation (defaults to `Params`).

## Async validation, ordering, and identity

- **Incoming messages (`messageSchema`)** may be async on WebSocket and on both SSE transports. On a `Socket`, frames are processed **in arrival order** (each message waits on the previous one), and work from a closed or superseded connection is discarded — a slower earlier message can’t overwrite newer data after the connection has changed.
- **Outgoing payloads (`sendSchema`)** stay synchronous on `send()` (returns a boolean). Asynchronous validation uses `sendAsync()`, which validates and then accepts into the ordered send queue.
- **Parameters (`paramsSchema`)** validate synchronously for render-time lookup. For async parameter work, call `prepare(params)` (or `getAsync`, or the `usePreparedParams` hook) and pass the returned prepared value to `get`/`useSocket`. `enabled: false` prevents a hook from opening a connection; it does not skip pool lookup or parameter handling.

## Transform boundaries

Schemas are typed `SocketSchema<Input, Output>`, where `Output` defaults to `Input` — a schema may transform between the two. Explicit generic arguments select the input and output types.

Keep WebSocket message output JSON-compatible: the validated value is re-serialized through JSON before entering the cache, so objects such as `Date` do not retain their runtime identity through that path.

## Preparing parameters in React

Keep the consuming hook in a child component. While preparation is pending, no prepared value exists; passing `undefined` to `useSocket` would attempt ordinary synchronous lookup.

```tsx
const client = new SocketClient({
  baseURL: "wss://example.com",
  url: "/rooms",
  paramsSchema: z.string().transform(async (room) => ({
    room: room.trim().toLowerCase(),
  })),
});

function Room({ name }: { name: string }) {
  const { params, error, isPending } = client.usePreparedParams(name);
  if (error) return <p>{error.message}</p>;
  if (isPending || !params) return <p>Preparing room…</p>;
  return <RoomStream params={params} />;
}

function RoomStream({ params }: {
  params: Awaited<ReturnType<typeof client.prepare>>;
}) {
  const socket = client.useSocket({ params });
  return <pre>{JSON.stringify(socket.data)}</pre>;
}
```

For imperative code, `const prepared = await client.prepare(input)` followed by `client.get(prepared)` avoids a second validation. `getAsync(input)` combines both steps. `closeAsync(input)` prepares and removes the matching instance.

Concurrent preparations of the same JSON-serializable input share validation work. Aborting one caller cancels its wait without cancelling another caller’s work. Standard Schema does not provide a cancellation argument to validators: underlying work may continue, but a cancelled caller does not create a socket. `closeAll()` invalidates outstanding preparations.

For fresh credentials on each reconnection, use [connection preparation](/api/options#connection-preparation-diagnostics) rather than adding a changing token to stable subscription identity.

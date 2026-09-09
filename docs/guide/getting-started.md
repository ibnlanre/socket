# Getting started

This is the smallest useful setup: create one client, call `useSocket`, and render the selected data.

## Quick start

```tsx
import { SocketClient } from "@ibnlanre/socket";

const priceClient = new SocketClient<string>({
  baseURL: "wss://example.com",
  url: "/prices",
});

export function PriceTicker() {
  const price = priceClient.useSocket({
    select: (message) => message ?? "Waiting for price...",
  });

  return <div>{price.data}</div>;
}
```

`useSocket` opens the connection for you (unless you pass `enabled: false`) and returns a reactive snapshot. Here `select` maps the raw latest message (`string | undefined`) into whatever you want to render — so `data` stays a `string` even before the first message arrives.

## A typed chat room

```tsx
import { SocketClient } from "@ibnlanre/socket";
import { z } from "zod";

const messageSchema = z.object({
  type: z.enum(["message", "notification"]),
  content: z.string(),
  sender: z.string(),
  timestamp: z.number(),
});

const sendSchema = z.object({ content: z.string().min(1) });
const paramsSchema = z.object({ room: z.string() });

const chatClient = new SocketClient({
  baseURL: "wss://chat.example.com",
  url: "/ws",
  messageSchema,
  sendSchema,
  paramsSchema,
  retry: true,
  retryDelay: 1000,
});

export function ChatRoom({ room }: { room: string }) {
  const socket = chatClient.useSocket({ params: { room } });

  const send = () => socket.send({ content: "Hello!" });

  return (
    <div>
      <p>{socket.fetchStatus}</p>
      {socket.data && (
        <p>
          <strong>{socket.data.sender}</strong>: {socket.data.content}
        </p>
      )}
      <button onClick={send} disabled={!socket.isConnected}>
        Send
      </button>
    </div>
  );
}
```

When `room` changes, `useSocket` swaps to the pooled socket for that room — and because sockets are pooled, two `ChatRoom`s in the same room share one connection.

## Imperative access

When you need direct control outside React, use `get` for the managed `Socket`:

```ts
const socket = await chatClient.get({ room: "general" });

socket.open();
await socket.waitUntil("open");

await socket.send({ content: "hello" });
await socket.waitUntil("message");

const unsubscribe = socket.on("message", (event) => {
  console.log("raw message", event);
});

// later…
unsubscribe();
socket.close();
```

## What's next

- [Socket pooling](/guide/socket-pooling) — how connections are shared and reused.
- [Lifecycle & status](/guide/lifecycle) — what `status`, `fetchStatus`, and the derived flags mean.
- [Validation](/guide/validation) — runtime schemas for params, sends, and messages.

# Socket pooling

`SocketClient` maintains a **pool** of `Socket` instances keyed by the fully built URL — the resolved `baseURL + url` plus the serialized `params`. This is what lets many components share a single live connection.

## How the key is built

When you call `get(params)` or `useSocket({ params })`, the client:

1. Runs `params` through `paramsSchema` if one is configured (see [Validation](/guide/validation) for the sync constraint).
2. Serializes the validated params.
3. Resolves the full URL: `baseURL + url` + serialized query params.

Identical URLs ⇒ identical keys ⇒ the **same `Socket` instance**.

```ts
const a = client.get({ room: "general" });
const b = client.get({ room: "general" });

a === b; // true
```

## Sharing is the default

Because the same params reuse the same socket, you can render the same `useSocket` call from many components and they will all observe one connection — no special opt-in required.

You can assert sharing at runtime by comparing the command references returned by the hook:

```ts
const first = useSocket({ params });
const second = useSocket({ params });

first.send === second.send; // true — both bound to the same pooled socket
```

## Closing pooled sockets

| Method | Behavior |
| --- | --- |
| `client.close(params)` | Closes the socket for `params`, clears its cache, and removes it from the pool. Returns `false` if no such socket exists. |
| `client.closeAll()` | Closes every pooled socket and returns the number closed. |

```ts
// Close just one room's connection…
client.close({ room: "general" });

// …or tear everything down.
const closed = client.closeAll();
```

## Subscribe vs. on

Two components sharing one pooled socket must each register their **own** listener handler — subscriptions are keyed by handler reference (see [Listeners](/guide/listeners)). If a component unmounts, only its own subscription is removed; the other component's keeps working.

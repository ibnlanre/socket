# `SocketClient`

A pool of shared [`Socket`](/api/socket) instances for one endpoint, with a React subscription hook.

```ts
class SocketClient<
  Get = unknown,
  Post = never,
  Params extends ConnectionParams = never,
  ParamsInput = Params,
> {
  constructor(configuration: SocketClientConstructor<Get, Post, Params, ParamsInput>);
}
```

Schemas infer message output (`Get`), accepted send input (`Post`), normalized parameters (`Params`), and parameter input (`ParamsInput`). Without schemas, supply those types explicitly.

## `get(params?, options?)`

Validates and transforms parameters, then returns the socket for the resulting URL. Both synchronous and asynchronous schemas use this method. It creates a pooled instance when needed; call `open()` to connect.

```ts
get(
  params?: ParamsInput,
  options?: { signal?: AbortSignal },
): Promise<Socket<Get, Post, Params>>;

const socket = await client.get({ room: "general" });
socket.open();
```

Equivalent normalized URLs share an instance. Concurrent resolutions of identical JSON input share validation work. Each caller can cancel its own wait. The pool retains at most `maxPoolSize` instances (default `1000`); further identities reject with a `RangeError` until an unused socket is evicted.

## `useSocket(options?)`

Subscribes to a pooled socket and opens it. Parameter validation starts in an effect. While it resolves, `fetchStatus` is `"preparing"` and `isPreparing` is `true`; validation failures appear in `error` with `isError: true`.

```ts
useSocket<State = Get | undefined>(
  options?: UseSocketOptions<Get, State, ParamsInput>,
): UseSocketResult<Get, Post, State>;
```

```tsx
function Room({ name }: { name: string }) {
  const socket = client.useSocket({
    params: { room: name },
    enabled: Boolean(name),
    select: (message) => message ?? null,
  });

  if (socket.isPreparing) return <p>Preparing room…</p>;
  if (socket.isError) return <p>{socket.error?.message}</p>;
  return <pre>{JSON.stringify(socket.data)}</pre>;
}
```

`enabled: false` skips parameter resolution and subscription entirely. The hook returns idle state and selected placeholder data. Changing parameters cancels the previous resolution and pending sends from that subscription; stale results cannot replace the current state. Unmounting releases the subscription, allowing the socket's idle timeout to close it when no subscribers remain.

The result contains read-only state, selected `data`, and `send(payload, { signal }?)`. A send made during preparation waits for that subscription's socket. `send` remains stable while parameters and `enabled` are unchanged. Each hook owns its wrapper; consumers sharing a connection need not share command references.

Connection controls and raw listeners belong to the imperative socket returned by `get`. The hook observes all exposed state, so metadata changes can render the component even when selected data is equal.

`initialData` is data the caller already has, such as a snapshot fetched on the server. It is the value during server rendering and hydration, and seeds the socket when it resolves, so a stored copy never replaces it. It is real data: `isPending` and `isPlaceholderData` are `false`. See [Caching → initialData](/guide/caching#data-from-the-server-initialdata).

## `evict(params?, options?)`

Disposes a matching socket and removes it from the pool. Resolves `false` if none exists. Uses the same parameter validation and URL identity as `get`.

```ts
evict(params?: ParamsInput, options?: { signal?: AbortSignal }): Promise<boolean>;

await client.evict({ room: "general" });
```

Detach consumers before eviction. Cache deletion follows `clearCacheOnClose` and does not clear other identities' cache entries.

## `clear()`

Disposes all pooled sockets and invalidates pending resolutions. Returns the number removed. The client remains reusable.

```ts
clear(): number;
```

## `clearCache()`

Deletes the client's store, as on sign-out. The store is named by `cacheKey`, or by the origin when there is none, and is shared by every client on that name. Held values and open connections are untouched; later messages are stored again. Runs whether or not `disableCache` is set.

```ts
clearCache(): Promise<void>;

await client.clearCache();
```

## `dispose()`

Permanently releases the client and its sockets. Further resolution rejects. Call this when the owner of the client is finished with it.

```ts
dispose(): void;
```

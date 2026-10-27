# `SocketCache`

In-memory mirror + **Cache API** persistence, one cache per origin name. It backs every `Socket`'s cache-first behavior and is also exported for standalone use.

Cache Storage is the default persistent backend whenever it exists; `cacheFallback` only applies when it does not. Persisted entries outlive the connection and the page, are scoped to the origin (or `cacheKey`), and are shared by every page on that origin — read [Caching → Persistence and privacy](/guide/caching#persistence-and-privacy) before storing sensitive data.

```ts
class SocketCache<State = unknown> {
  static isAvailable: boolean; // "caches" in globalThis
  constructor(options: SocketCacheConstructor<State>);
}
```

> The constructor options type (`SocketCacheConstructor`) is not exported from the package entry. When constructed by `Socket` it receives cache options from the client config (see [Reference → Options](/api/options)).

## Static

- `SocketCache.isAvailable` — **deprecated.** Whether the ambient `caches` global exists. It cannot describe an injected adapter, so prefer the instance `persistence` property.

## Methods

### `get(path)`

Returns the stored value, or `undefined` on a miss or when expired (an expired entry is deleted on read).

```ts
get(path: string): Promise<State | undefined>;
```

### `set(path, value)`

Stores a JSON string under `path` with `Expires = now + maxCacheAge` and `Cache-Control: private`, `Content-Type: application/json`, `Content-Length`, and `X-Socket-Cache-Encoding` (`wire`, `cipher` or `plain`) so a read knows whether to decrypt. The held state is always readable; `encrypt` applies to the stored copy only. With `disableCache`, writes to the Cache API are skipped but the in-memory mirror and notifications still update.

```ts
set(path: string, value: string): Promise<void>;
```

### `has(path)` / `remove(path)` / `clear()`

`clear()` deletes the whole store (by its name, `cacheKey` or the origin), not just this cache's path. The held state stays, and a later `set` creates the store again.

```ts
has(path: string): Promise<boolean>;
remove(path: string): Promise<boolean>;
clear(): Promise<void>;
```

### `subscribe(observer)`

Registers a state observer and returns its unsubscribe. `Socket` wires its state observer here so cached writes flow into `socket.value`/`status`.

```ts
subscribe(observer: (state: State) => void): () => void;
```

### `seed(value)`

Holds `value` when nothing is held yet, and returns whether it did. Seeded state is not stored, and `initialize` does not replace it.

```ts
seed(value: State): boolean;
```

### `initialize(path)`

Selects the storage backend and hydrates the in-memory state from the stored entry for `path`, unless state is already held.

- Cache Storage (ambient, or injected as `runtime.caches`) → `persistence: "cache-storage"`.
- Otherwise `cacheFallback: "none"` (the default) → no caching, `persistence: "none"`.
- Otherwise `cacheFallback: "memory"` → in-memory backend, `persistence: "memory"`.

```ts
initialize(path: string): Promise<void>;
```

### `decrypt(data)`

Applies the configured decryption cipher when encryption is enabled.

```ts
decrypt(data: State): State;
```

## Properties

- `value: State | undefined` — the in-memory latest value.
- `persistence: "cache-storage" | "memory" | "none"` — the backend actually selected by `initialize()`. `"memory"` is explicit opt-in and does not survive a reload.

## Standalone example

```ts
import { SocketCache } from "@ibnlanre/socket";

const cache = new SocketCache({
  origin: "https://test.example.com",
  maxCacheAge: 60_000,
});

cache.subscribe((state) => console.log("state changed", state));

await cache.initialize("/path");
await cache.set("/path", JSON.stringify({ count: 1 }));
console.log(cache.value); // { count: 1 }

const value = await cache.get("/path"); // { count: 1 }
await cache.remove("/path");
await cache.clear();
```

See [Guide → Caching](/guide/caching) for configuration options and expiry semantics.

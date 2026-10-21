# `SocketCache`

In-memory mirror + **Cache API** persistence, one cache per origin name. It backs every `Socket`'s cache-first behavior and is also exported for standalone use.

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

Stores a JSON string under `path` with `Expires = now + maxCacheAge` and `Cache-Control: private`, `Content-Type: application/json`, `Content-Length`. With `disableCache`, writes to the Cache API are skipped but the in-memory mirror and notifications still update.

```ts
set(path: string, value: string): Promise<void>;
```

### `has(path)` / `remove(path)` / `clear()`

```ts
has(path: string): Promise<boolean>;
remove(path: string): Promise<boolean>;
clear(): Promise<void>;
```

### `subscribe(observer)`

Registers a state observer (add-only — there is no unsubscribe). `Socket` wires its state observer here so cached writes flow into `socket.value`/`status`.

```ts
subscribe(observer: (state: State) => void): void;
```

### `initialize(path)`

Selects the storage backend and hydrates the in-memory state from the stored entry for `path`:

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

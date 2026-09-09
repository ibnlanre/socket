# Caching

`@ibnlanre/socket` is **cache-first**. Each `Socket` carries a `SocketCache` that mirrors the latest value in memory and persists it to the **Cache API** (keyed per origin). When you open a connection, the cache is hydrated **before** the socket dials — so a previously received value renders immediately while the fresh connection is established.

## Why it matters

A typical flow:

1. Component A opens `/prices`. The cache is empty, so `status` is `"loading"`.
2. A `price` message arrives → validated → stored in the cache → `status` becomes `"success"`.
3. Component A unmounts (last subscriber leaves). After `idleConnectionTimeout` the socket closes — but the value stays cached.
4. Component B mounts `useSocket` for the same URL. Before connecting, `open()` hydrates from the cache and renders the cached price immediately, with `status: "stale"` (`isStaleData: true`), until the first live message flips it back to `"success"`.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `cacheKey` | origin of the URL | Cache name to use (instead of the origin) |
| `maxCacheAge` | `"15 minutes"` | How long entries live before expiring |
| `clearCacheOnClose` | `false` | Clear the cache when the socket closes |
| `disableCache` | `false` | Skip Cache API writes (keeps in-memory mirror + notifications) |

```tsx
new SocketClient({
  baseURL: "wss://example.com",
  url: "/prices",
  maxCacheAge: "5 minutes", // expire faster
  disableCache: true,       // don't persist to the Cache API
});
```

## Expiry semantics

Entries are stored with an `Expires` timestamp of `now + maxCacheAge` plus `Cache-Control: private` and `Content-Type: application/json`. An entry whose `Expires` has passed is **deleted on read** and treated as a cache miss — you'll see `"loading"` again, not stale data.

## What's cached and where

- Keys are the socket's `path` (the pathname of the resolved URL) within a cache named by the **origin** (or `cacheKey`).
- `SocketCache.set(path, value)` stores a **JSON string** with the headers above.
- `socket.value` and `cache.value` are the in-memory mirrors of the latest parsed message.

## Data handling & transforms

Related options for fine-grained control of stored values:

| Option | Default | Description |
| --- | --- | --- |
| `placeholderData` | `undefined` | Value to surface before any real message (`isPlaceholderData: true`) |
| `setStateAction` | identity | Reducer `(nextState, currentState?) => State` that computes the stored state |
| `encrypt` / `decrypt` | `undefined` | `SocketCipher = (data) => unknown` applied on write / read |
| `encryptPayload` | `true` | Encrypt the serialized payload on write |
| `decryptData` | `true` | Decrypt data on read via `get`/`set` |

## Standalone use

`SocketCache` is exported and usable on its own:

```ts
import { SocketCache } from "@ibnlanre/socket";

const cache = new SocketCache({
  origin: "https://test.example.com",
  maxCacheAge: 60_000, // ms
});

const unsubscribe = cache.subscribe((state) => console.log(state));

await cache.set("/path", JSON.stringify({ count: 1 }));
const value = await cache.get("/path"); // { count: 1 }
await cache.remove("/path");
await cache.clear();
```

See [Reference → SocketCache](/api/socket-cache) for the full method list.

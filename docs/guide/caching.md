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
| `cacheFallback` | `"none"` | Only consulted when Cache Storage is unavailable: `"none"` stops caching, `"memory"` opts into a non-persistent cache |

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

## Persistence and privacy

**Cache Storage remains the default persistent backend whenever the browser provides it.** `cacheFallback` does not switch that off — it only decides what happens when Cache Storage is missing, such as in Node or a restricted context.

Persisted entries:

- **Outlive the connection.** Closing the socket, unmounting every component, or navigating away does not remove them. They are read back on the next `open()` until `maxCacheAge` expires them.
- **Outlive the page.** The browser stores them per origin, so they survive reloads.
- **Are shared across the origin.** Every page on that origin that uses the same cache name sees the same entries. Entries are keyed by the socket path, so two sockets on one origin with the same path share one entry.
- **Are not encrypted by default.** `Cache-Control: private` is entry metadata, not an access control or a confidentiality guarantee: it does not make the stored JSON unreadable to other scripts on the origin, and it does not remove it from disk.

Cached payloads are whatever your server last sent, so **avoid caching credentials, tokens, personal data, or anything whose exposure after logout would matter** — unless you mitigate it:

| Mitigation | Effect |
| --- | --- |
| `disableCache: true` | Never writes to Cache Storage; the in-memory mirror and notifications still work |
| `clearCacheOnClose: true` | Deletes the entry when the socket closes |
| `maxCacheAge` | Shortens how long an entry survives |
| `encrypt` / `decrypt` | Transforms the payload before storage; see the caveat below |

::: warning Encryption does not create a same-origin boundary
`encrypt` and `decrypt` run inside your page. Any script that can read the cached entry can also reach the cipher and any key material bundled with it, so client-side encryption does **not** protect against malicious JavaScript running on the same origin, and it does not protect against a compromised origin.

It reduces what is stored in plaintext; it is not an access control. The effective boundaries are origin isolation, server-side authorization, and key management — including where the key lives and how it is rotated. Evaluate those against your own threat model rather than treating `encrypt` as a guarantee.
:::

Use `SocketCache.persistence` to confirm which backend is actually live rather than assuming:

| Value | Meaning |
| --- | --- |
| `"cache-storage"` | Persistent; survives reloads |
| `"memory"` | In-memory only; dies with the instance |
| `"none"` | Nothing is stored |

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

# Prelaunch API changes

## 0.2.0 — runtime portability

0.2.0 is additive: no export was removed or renamed, and the new options are optional. One behavior changed — how `EventSourceClient` picks its transport — but requests that worked before keep working without a code change.

### SSE transport is no longer chosen by HTTP method

Before 0.2.0, `EventSourceClient` used native `EventSource` whenever `method` was `"GET"` and fetch streaming otherwise. That made GET streams fail in runtimes without `EventSource` (every Node release) and made the fetch path unreachable unless you changed the verb.

`transport` now selects the transport explicitly:

| `transport` | Behavior |
| --- | --- |
| `"auto"` (default) | Native when the whole request is expressible by it — GET, no custom headers, no body, no initial `Last-Event-ID` — otherwise fetch |
| `"native"` | Native only; incompatible configuration throws, naming the offending option |
| `"fetch"` | Fetch only; throws when no `fetch` implementation exists |

`client.transport` reports `"native"` or `"fetch"` for the current connection. A browser GET without headers still resolves to native, and a non-GET request still resolves to fetch.

### Runtime implementations can be injected

Use `runtime` instead of relying on globals:

```ts
new SocketClient({ url: "/ws", runtime: { webSocket: WsWebSocket } });
new EventSourceClient({ url: "/sse", runtime: { eventSource, fetch } });
```

Adapters win over globals, and globals are read only when an operation needs them. Importing or constructing a client never depends on the runtime providing a transport. A missing implementation raises an error naming `runtime.webSocket` / `runtime.eventSource` / `runtime.fetch` at `open()`.

### The cache backend is explicit

`SocketCache.persistence` reports what is actually in use. `cacheFallback` applies only when Cache Storage is absent: `"none"` (default) stops caching, `"memory"` opts into a non-persistent cache.

`SocketCache.isAvailable` is deprecated: it inspects only the ambient global and cannot describe an injected adapter.

## Asynchronous resolution and sends

The API now treats subscription resolution and sends as asynchronous operations, with one method for each. These are breaking changes before launch.

| Previous API | Current API |
| --- | --- |
| Synchronous socket lookup and separate preparation methods | `await client.get(params, { signal }?)` |
| Separate parameter preparation hook | `client.useSocket({ params })` owns preparation |
| Separate synchronous and asynchronous send methods | `await socket.send(payload, { signal }?)` |
| Client close method and eviction alias | `await client.evict(params)` |
| Close all pooled sockets | `client.clear()` |
| Permanent client teardown | `client.dispose()` |
| Selected-value hook | `client.useSocket({ select }).data` |

React results expose state, selected `data`, and `send`. Get the imperative socket with `await client.get(params)` for `open`, `close`, raw listeners, and event waits. A component's subscription does not expose controls that disconnect other consumers.

Handle rejected sends with `try`/`catch`. Successful resolution means local acceptance; it does not establish server delivery. See [queue guarantees](/guide/sending#queue-guarantees).

`enabled: false` now skips parameter resolution and subscriptions. `isPreparing` covers parameter resolution and connection preparation; `isPending` describes the absence of data. Parameter changes cancel the old subscription's pending work.

`socket.close()` remains reversible and preserves listeners. `socket.dispose()`, `client.evict()`, `client.clear()`, and `client.dispose()` permanently release affected socket instances. Detach their consumers first.

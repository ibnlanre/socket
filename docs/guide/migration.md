# Prelaunch API changes

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

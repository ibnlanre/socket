# Migrating connection behavior

This update strengthens identity, async processing, and lifecycle guarantees. Existing synchronous `get` and `send` calls keep their return types, but several behaviors are deliberately different.

| Before | Now | Action |
| --- | --- | --- |
| Query values were double encoded | Values are encoded once; object keys are sorted | Remove any extra decoding in your backend; old persisted URL keys may no longer match |
| Parameter transforms only affected pool identity | The same normalized URL reaches the transport | Remove workarounds that manually duplicate schema transforms |
| Repeated queued sends silently coalesced | Every call remains distinct when deduplication is disabled | Enable `deduplicationWindow` when coalescing is desired |
| Pending duplicates returned `true` with deduplication enabled | Suppressed duplicates return `false` | Treat `false` as suppressed, not transport failure |
| `socket.close()` cleared subscriptions | It preserves subscriptions for reopening | Use `dispose()` for permanent release |
| Client removal cleared the shared cache namespace | Eviction disposes its instance without broad cache deletion | Use `clearCacheOnClose` or explicit cache removal |
| Waiting sends and retained pool entries were unbounded | Default limits are 1000; waiting sends expire after one minute | Configure limits and evict unused identities |
| Async messages could finish out of order | Validation commits in arrival order | Keep validators bounded in latency; slow work delays later messages |

A full hook result updates for every exposed state change. Use `useValue` with a selector and optional equality function when you only need selected data.

For async parameter schemas, prepare outside render or use `usePreparedParams`, then pass the prepared result to the consuming component. `enabled: false` on `useSocket` does not skip lookup or validation. For async outgoing schemas, use `sendAsync`.

Authentication preparation does not change pool/cache identity. Include stable account or tenant identity in the subscription key, and remove private cache data explicitly when required by your application's session lifecycle.

This library remains a JSON state client. It does not implement application acknowledgements, exactly-once delivery, or backend-specific heartbeat/resume protocols. JSON persistence does not preserve class instances produced by transforms.

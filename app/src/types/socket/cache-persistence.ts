/**
 * The backend actually selected by a `SocketCache`.
 *
 * - `"cache-storage"` — persistent Cache Storage; survives reloads.
 * - `"memory"` — in-memory only; lives and dies with the instance.
 * - `"none"` — nothing is cached.
 */
export type CachePersistence = "cache-storage" | "memory" | "none";

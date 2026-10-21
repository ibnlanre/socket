import type { UnitValue } from "../time-unit";

export type SocketCacheOptions = {
  /**
   * The key to use for caching the data
   *
   * @description The default key is the origin of the WebSocket connection
   */
  cacheKey?: string;

  /**
   * Whether to clear the cache when the connection is closed.
   *
   * @default false
   */
  clearCacheOnClose?: boolean;

  /**
   * Whether to cache the data or not
   *
   * @default false
   */
  disableCache?: boolean;

  /**
   * What to do when the runtime has no Cache Storage.
   *
   * `"none"` stops caching. `"memory"` opts into a non-persistent cache, so
   * the data is available for the life of the instance but does not survive a
   * reload — inspect `SocketCache.persistence` to see which backend is live.
   *
   * @default "none"
   */
  cacheFallback?: "none" | "memory";

  /**
   * The maximum age of the cache data
   *
   *
   * @default "15 minutes"
   */
  maxCacheAge?: UnitValue;
};

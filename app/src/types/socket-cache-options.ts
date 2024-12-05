import type { UnitValue } from "./socket-time-unit";

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
   * The maximum age of the cache data
   *
   *
   * @default "15 minutes"
   */
  maxCacheAge?: UnitValue;
};

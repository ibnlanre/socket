export type SocketCacheOptions = {
  /**
   * Whether to cache the data or not
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
   * The key to use for caching the data
   *
   * @description The default key is the URL of the WebSocket connection
   */
  cacheKey?: string;

  /**
   * The maximum age in milliseconds of the cached items
   *
   *
   * @default 90_0000 (15 minutes)
   */
  maxCacheAge?: number;
};

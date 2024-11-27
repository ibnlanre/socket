export type SocketCache = {
  // /**
  //  * Whether to cache the data or not
  //  * @default true
  //  *
  //  * @description If set to true, the data will be cached using the Cache Storage API
  //  * @description If set to false, the data will not be cached
  //  */
  // cache?: boolean;
  /**
   * The key to use for caching the data
   * @default "default-cache"
   */
  cacheName?: string;
};

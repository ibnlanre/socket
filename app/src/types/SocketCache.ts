export type SocketCache =
  | {
      /**
       * Whether to cache the data or not
       * @default false
       *
       * @description If set to false, the data will not be cached
       */
      cache?: false;
      key?: never;
    }
  | {
      /**
       * Whether to cache the data or not
       * @default true
       *
       * @description If set to true, the data will be cached using the Cache Storage API
       */
      cache: true;
      /**
       * The key to use for caching the data
       * @default "no-cache"
       */
      key: string[];
    };

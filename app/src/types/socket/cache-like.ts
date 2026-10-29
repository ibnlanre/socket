/** The subset of the Cache API that `SocketCache` relies on. */
export type CacheLike = {
  delete(request: RequestInfo | URL): Promise<boolean>;
  keys(): Promise<readonly RequestInfo[]>;
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
};

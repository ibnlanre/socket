import type { CacheLike } from "@/types/socket/cache-like";

/**
 * Non-persistent stand-in used when `cacheFallback: "memory"` is requested and
 * the runtime has no Cache Storage. It does not survive a reload, which is why
 * `persistence` reports `"memory"` and not `"cache-storage"`.
 */
export class MemoryCache implements CacheLike {
  #entries = new Map<string, Response>();

  delete = async (request: RequestInfo | URL): Promise<boolean> =>
    this.#entries.delete(this.#key(request));

  keys = async (): Promise<readonly RequestInfo[]> => [...this.#entries.keys()];

  // Response bodies are single-use, so hand out a clone on every read.
  match = async (request: RequestInfo | URL): Promise<Response | undefined> =>
    this.#entries.get(this.#key(request))?.clone();

  put = async (
    request: RequestInfo | URL,
    response: Response
  ): Promise<void> => {
    this.#entries.set(this.#key(request), response.clone());
  };

  #key = (request: RequestInfo | URL): string => {
    if (typeof request === "string") return request;
    if ("url" in request) return request.url;
    return String(request);
  };
}

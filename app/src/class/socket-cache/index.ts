import { isJSON } from "@/functions/is-json";
import type { RuntimeAdapters } from "@/types/runtime";
import type { CachePersistence } from "@/types/socket/cache-persistence";
import type { SocketCipher } from "@/types/socket/cipher";
import type { SocketSetStateAction } from "@/types/socket/set-state-action";

/** The subset of the Cache API that `SocketCache` relies on. */
type CacheLike = {
  delete(request: RequestInfo | URL): Promise<boolean>;
  keys(): Promise<readonly RequestInfo[]>;
  match(request: RequestInfo | URL): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
};

/**
 * Non-persistent stand-in used when `cacheFallback: "memory"` is requested and
 * the runtime has no Cache Storage. It does not survive a reload, which is why
 * `persistence` reports `"memory"` and not `"cache-storage"`.
 */
class MemoryCache implements CacheLike {
  #entries = new Map<string, Response>();

  #key = (request: RequestInfo | URL): string => {
    if (typeof request === "string") return request;
    if ("url" in request) return request.url;
    return String(request);
  };

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
}

/**
 * How a stored entry was written, so a read knows whether to decrypt it.
 *
 * - `"wire"` — the message as received; read through `decrypt` like one.
 * - `"cipher"` — the state passed through `encrypt`; read through `decrypt`.
 * - `"plain"` — the reduced state; read as is.
 */
type CacheEncoding = "cipher" | "plain" | "wire";

const CacheEncodingHeader = "X-Socket-Cache-Encoding";

type SocketCacheConstructor<State = unknown> = {
  decrypt?: SocketCipher;
  decryptData: boolean;
  disableCache: boolean;
  encrypt?: SocketCipher;
  fallback?: "none" | "memory";
  maxCacheAge: number;
  origin: string;
  runtime?: RuntimeAdapters;
  setStateAction?: SocketSetStateAction<State>;
};

export class SocketCache<State = unknown> {
  /**
   * @deprecated Use the instance `persistence` property, which reports the
   * backend actually selected and accounts for injected runtime adapters.
   */
  static isAvailable: boolean = "caches" in globalThis;

  /** The backend in use; resolved by `initialize()`. */
  persistence: CachePersistence = "none";

  #cache: CacheLike | undefined;
  #decrypt?: SocketCipher;
  #decryptData: boolean;
  #disableCache: boolean;
  #encrypt?: SocketCipher;
  #fallback: "none" | "memory";
  #maxCacheAge: number;
  #observers: Set<(value: State) => void> = new Set();
  #origin: string;
  #runtime?: RuntimeAdapters;
  #setStateAction?: SocketSetStateAction<State>;
  #state: State | undefined;
  #writes: Promise<void> = Promise.resolve();

  constructor({
    decrypt,
    decryptData,
    disableCache,
    encrypt,
    fallback = "none",
    maxCacheAge,
    origin,
    runtime,
    setStateAction,
  }: SocketCacheConstructor<State>) {
    this.#decrypt = decrypt;
    this.#decryptData = decryptData;
    this.#disableCache = disableCache;
    this.#encrypt = encrypt;
    this.#fallback = fallback;
    this.#maxCacheAge = maxCacheAge;
    this.#origin = origin;
    this.#runtime = runtime;
    this.#setStateAction = setStateAction;
  }

  #notifyObservers = (): void => {
    // #state is always assigned before #notifyObservers runs (see set/initialize).
    const state = this.#state as State;
    for (const observer of this.#observers) {
      observer(state);
    }
  };

  #decode = (data: State, encoding: string | null): State | undefined => {
    switch (encoding) {
      case "plain":
        return data;
      case "cipher":
        // Unreadable without the counterpart to `encrypt`.
        return this.#decrypt ? (this.#decrypt(data) as State) : undefined;
      default:
        // A message as received, including entries stored before the header.
        return this.decrypt(data) as State;
    }
  };

  #encode = (message: string, state: State): [string, CacheEncoding] => {
    if (this.#encrypt) return [JSON.stringify(this.#encrypt(state)), "cipher"];
    if (this.#setStateAction) return [JSON.stringify(state), "plain"];
    return [message, "wire"];
  };

  clear = async (): Promise<void> => {
    if (!this.#cache) return;

    await this.#writes;
    const keys = await this.#cache.keys();
    await Promise.all(keys.map((request) => this.#cache!.delete(request)));
  };

  decrypt = (data: State) => {
    if (this.#decryptData && this.#decrypt) {
      return this.#decrypt(data);
    }
    return data;
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;

    await this.#writes;
    const response = await this.#cache.match(path);

    if (response) {
      const timestamp = response.headers.get("Expires") || 0;

      if (new Date(timestamp).getTime() < Date.now()) {
        await this.#cache.delete(path);
        return;
      }

      const data = await response.json();
      return this.#decode(data, response.headers.get(CacheEncodingHeader));
    }
  };

  has = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    await this.#writes;
    const response = await this.#cache.match(path);
    return response !== undefined;
  };

  initialize = async (path: string, current = () => true): Promise<void> => {
    if (this.#disableCache) {
      this.persistence = "none";
      return;
    }

    const storage =
      this.#runtime?.caches ??
      (typeof caches === "undefined" ? undefined : caches);

    if (storage) {
      this.#cache = await storage.open(this.#origin);
      this.persistence = "cache-storage";
    } else if (this.#fallback === "memory") {
      this.#cache ??= new MemoryCache();
      this.persistence = "memory";
    } else {
      this.persistence = "none";
      return;
    }

    const cachedData = await this.get(path);

    if (current() && isJSON(cachedData)) {
      this.#state = cachedData;
      this.#notifyObservers();
    }
  };

  subscribe = (observer: (value: State) => void): (() => void) => {
    this.#observers.add(observer);
    return () => {
      this.#observers.delete(observer);
    };
  };

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    await this.#writes;
    return await this.#cache.delete(path);
  };

  set = async (path: string, value: string): Promise<void> => {
    let data = JSON.parse(value) as State;

    if (this.#decryptData && this.#decrypt) {
      data = this.#decrypt(data) as State;
    }

    if (this.#setStateAction) {
      data = this.#setStateAction(data, this.#state);
    }

    this.#state = data;
    this.#notifyObservers();

    if (this.#disableCache) return;
    if (!this.#cache) return;

    const [stored, encoding] = this.#encode(value, data);
    const timestamp = new Date(Date.now() + this.#maxCacheAge);
    const size = new TextEncoder().encode(stored).length;
    const headers = new Headers();

    headers.set("Cache-Control", "private");
    headers.set("Content-Type", "application/json");
    headers.set("Expires", timestamp.toUTCString());
    headers.set("Content-Length", size.toString());
    headers.set(CacheEncodingHeader, encoding);

    const response = new Response(stored, {
      headers,
    });

    const cache = this.#cache;
    const write = this.#writes.then(() => cache.put(path, response));
    this.#writes = write.catch(() => {});
    await write;
  };

  get value(): State | undefined {
    return this.#state;
  }
}

import { isJSON } from "@/functions/is-json";
import type { SocketSetStateAction } from "@/types/socket-set-state-action";

type SocketCacheConstructor<State = unknown, Action = never> = {
  decryptData: (data: State) => State;
  disableCache: boolean;
  maxCacheAge: number;
  origin: string;
  reducer?: SocketSetStateAction<State, Action>;
};

export class SocketCache<State = unknown, Action = never> {
  static isAvailable: boolean = "caches" in globalThis;

  #cache: Cache | undefined;
  #decryptData: (data: State) => State;
  #disableCache: boolean;
  #maxCacheAge: number;
  #observers: Set<Function> = new Set();
  #origin: string;
  #reducer?: SocketSetStateAction<State, Action>;
  #state: State | undefined;

  constructor({
    decryptData,
    disableCache,
    maxCacheAge,
    origin,
    reducer,
  }: SocketCacheConstructor<State, Action>) {
    this.#decryptData = decryptData;
    this.#disableCache = disableCache;
    this.#maxCacheAge = maxCacheAge;
    this.#origin = origin;
    this.#reducer = reducer;
  }

  #notifyObservers = (): void => {
    for (const observer of this.#observers) {
      observer(this.#state);
    }
  };

  clear = async (): Promise<void> => {
    if (!this.#cache) return;

    const keys = await this.#cache.keys();
    for (const request of keys) this.#cache.delete(request);
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;

    const response = await this.#cache.match(path);

    if (response) {
      const timestamp = response.headers.get("Expires") || 0;

      if (new Date(timestamp).getTime() < Date.now()) {
        await this.#cache.delete(path);
        return;
      }

      const data = await response.json();
      return this.#decryptData(data);
    }
  };

  has = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const response = await this.#cache.match(path);

    return response !== undefined;
  };

  initialize = async (path: string): Promise<void> => {
    if (!SocketCache.isAvailable) return;

    this.#cache = await caches.open(this.#origin);
    const cachedData = await this.get(path);

    if (isJSON(cachedData)) {
      this.#state = cachedData;
      this.#notifyObservers();
    }
  };

  subscribe = (observer: Function): void => {
    this.#observers.add(observer);
  };

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    return await this.#cache.delete(path);
  };

  set = async (path: string, data: string): Promise<void> => {
    const value = JSON.parse(data);
    this.#state = this.#decryptData(value);
    this.#notifyObservers();

    if (this.#disableCache) return;
    if (!this.#cache) return;

    const timestamp = new Date(Date.now() + this.#maxCacheAge);
    const size = new TextEncoder().encode(data).length;
    const headers = new Headers();

    headers.set("Cache-Control", "private");
    headers.set("Content-Type", "application/json");
    headers.set("Expires", timestamp.toUTCString());
    headers.set("Content-Length", size.toString());

    const response = new Response(data, {
      headers,
    });

    await this.#cache.put(path, response);
  };

  get value(): State | undefined {
    return this.#state;
  }
}

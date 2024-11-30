type SocketCacheConstructor<State> = {
  url: string;
  decryptData: (data: State) => State;
  disableCache: boolean;
  maxCacheAge: number;
};

export class SocketCache<State> {
  static isAvailable: boolean = "caches" in globalThis;

  #observers: Set<Function> = new Set();
  #cache: Cache | undefined;
  #decryptData: (data: State) => State;
  #disableCache: boolean;
  #state: State | undefined;
  #maxCacheAge: number;
  #url: string;

  constructor({
    decryptData,
    disableCache,
    maxCacheAge,
    url,
  }: SocketCacheConstructor<State>) {
    this.#decryptData = decryptData;
    this.#disableCache = disableCache;
    this.#maxCacheAge = maxCacheAge;
    this.#url = url;
  }

  #notifyObservers = (): void => {
    for (const observer of this.#observers) {
      observer(this.#state);
    }
  };

  #replacePath = (path: string): string => {
    return path.replace(/^ws+:/, "https:");
  };

  clear = async (): Promise<void> => {
    if (!this.#cache) return;

    const keys = await this.#cache.keys();
    for (const request of keys) this.#cache.delete(request);
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;

    const supportedPath = this.#replacePath(path);
    const response = await this.#cache.match(supportedPath);

    if (response) {
      const timestamp = response.headers.get("Expires") || 0;

      if (new Date(timestamp).getTime() < Date.now()) {
        await this.#cache.delete(supportedPath);
        return;
      }

      const data = await response.json();
      return this.#decryptData(data);
    }
  };

  has = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const supportedPath = this.#replacePath(path);
    const response = await this.#cache.match(supportedPath);

    return response !== undefined;
  };

  initialize = async (path: string): Promise<void> => {
    if (!SocketCache.isAvailable) return;

    this.#cache = await caches.open(this.#url);
    this.#state = await this.get(path);
    this.#notifyObservers();
  };

  subscribe = (observer: Function): void => {
    this.#observers.add(observer);
  };

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const supportedPath = this.#replacePath(path);
    return await this.#cache.delete(supportedPath);
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

    const supportedPath = this.#replacePath(path);
    await this.#cache.put(supportedPath, response);
  };

  get value(): State | undefined {
    return this.#state;
  }
}

export class SocketCache<State> {
  static isAvailable: boolean = "caches" in globalThis;

  #url: string;
  #cache: Cache | undefined;
  #decryptData: (data: State) => State;
  #state: State | undefined;

  constructor(url: string, decryptData: (data: State) => State) {
    this.#decryptData = decryptData;
    this.#url = url;
  }

  #replacePath = (path: string): string => {
    return path.replace(/^ws+:/, "https:");
  };

  initialize = async (path: string): Promise<void> => {
    if (!SocketCache.isAvailable) return;

    this.#cache = await caches.open(this.#url);
    this.#state = await this.get(path);
  };

  set = async (path: string, data: string): Promise<void> => {
    const value = JSON.parse(data);
    this.#state = this.#decryptData(value);

    if (!this.#cache) return;
    const response = new Response(data, {
      headers: { "Content-Type": "application/json" },
    });

    const supportedPath = this.#replacePath(path);
    await this.#cache.put(supportedPath, response);
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;

    const supportedPath = this.#replacePath(path);
    const response = await this.#cache.match(supportedPath);

    if (response) {
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

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const supportedPath = this.#replacePath(path);
    return await this.#cache.delete(supportedPath);
  };

  get value(): State | undefined {
    return this.#state;
  }
}

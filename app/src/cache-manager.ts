class CacheManager<State> {
  static isAvailable: boolean = "caches" in self;

  #url: string;
  #cache?: Cache;

  constructor(url: string) {
    this.#url = url;
    this.#initialize();
  }

  async #initialize(): Promise<void> {
    if (!CacheManager.isAvailable) return;
    this.#cache = await caches.open(this.#url);
  }

  set = async (path: string, data: State): Promise<void> => {
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

    if (!this.#cache) return;
    await this.#cache.put(path, response);
  };

  get = async (path: string): Promise<State | undefined> => {
    if (!this.#cache) return;
    const response = await this.#cache.match(path);

    if (response) {
      const data = await response.json();
      return data as State;
    }
  };

  remove = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;
    return await this.#cache.delete(path);
  };

  has = async (path: string): Promise<boolean> => {
    if (!this.#cache) return false;

    const response = await this.#cache.match(path);
    return response !== undefined;
  };

  clear = async (): Promise<void> => {
    if (!this.#cache) return;

    const keys = await this.#cache.keys();
    const paths = keys.map((request) => {
      if (!this.#cache) return;
      this.#cache.delete(request);
    });

    await Promise.allSettled(paths);
  };
}

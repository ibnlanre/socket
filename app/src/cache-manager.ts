class CacheManager<CacheData> {
  static isAvailable: boolean = "caches" in self;

  #cacheName: string;
  #cache?: Cache;

  constructor(cacheName: string = "default-cache") {
    this.#cacheName = cacheName;
    this.#initializeCache();
  }

  // Initialize the cache and store it in the private property
  async #initializeCache(): Promise<void> {
    if (!CacheManager.isAvailable) {
      throw new Error("Cache Storage API is not available in this environment");
    }

    this.#cache = await caches.open(this.#cacheName);
  }

  // Method to cache data using Cache Storage API
  async set(url: string, data: CacheData): Promise<void> {
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });

    if (!this.#cache) return;
    await this.#cache.put(url, response);
  }

  // Method to retrieve cached data based on URL
  async get(url: string): Promise<CacheData | undefined> {
    if (!this.#cache) return;
    const response = await this.#cache.match(url);

    if (response) {
      const data = await response.json();
      return data as CacheData;
    }
  }

  // Method to delete cached data based on URL
  async remove(url: string): Promise<boolean> {
    if (!this.#cache) return false;
    return await this.#cache.delete(url);
  }

  // Method to check if data is cached based on URL
  async has(url: string): Promise<boolean> {
    if (!this.#cache) return false;
    const response = await this.#cache.match(url);
    return response !== undefined;
  }

  // Method to clear all cached data
  async clear(): Promise<void> {
    if (!this.#cache) return;
    const keys = await this.#cache.keys();

    await Promise.allSettled(
      keys.map((request) => {
        if (!this.#cache) return;
        this.#cache.delete(request);
      })
    );
  }
}

type CacheData = Record<string, any>;

class CacheManager {
  static isAvailable: boolean = "caches" in self;

  #cacheName: string = "default-cache";
  #cache!: Cache;

  constructor(cacheName: string = this.#cacheName) {
    this.#cacheName = cacheName;
    this.#initializeCache();
  }

  // Initialize the cache and store it in the private property
  async #initializeCache(): Promise<void> {
    this.#cache = await caches.open(this.#cacheName);
  }

  // Method to cache data using Cache Storage API
  async set(url: string, data: CacheData): Promise<void> {
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
    await this.#cache.put(url, response);
  }

  // Method to retrieve cached data based on URL
  async get(url: string): Promise<CacheData | undefined> {
    const response = await this.#cache.match(url);

    if (response) {
      const data = await response.json();
      return data as CacheData;
    }

    return undefined;
  }

  // Method to delete cached data based on URL
  async remove(url: string): Promise<boolean> {
    return await this.#cache.delete(url);
  }

  // Method to check if data is cached based on URL
  async has(url: string): Promise<boolean> {
    const response = await this.#cache.match(url);
    return response !== undefined;
  }

  // Method to clear all cached data
  async clear(): Promise<void> {
    const keys = await this.#cache.keys();
    await Promise.allSettled(
      keys.map((request) => this.#cache.delete(request))
    );
  }
}

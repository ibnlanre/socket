import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocketCache } from "./index";

describe("SocketCache", () => {
  const defaults = {
    decryptData: true,
    disableCache: false,
    maxCacheAge: 60000,
    origin: "https://test.example.com",
  };

  // Mock global storage tools for Cache API testing
  type MockCache = {
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };
  type MockCacheStorage = {
    open: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockCacheStorage: MockCacheStorage;
  let mockCache: MockCache;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Set up standard mock responses for native Cache API calls
    mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      keys: vi.fn().mockResolvedValue([]),
    };

    mockCacheStorage = {
      open: vi.fn().mockResolvedValue(mockCache),
      delete: vi.fn().mockResolvedValue(true),
    };

    // Safely inject mock cache onto globalThis scope
    vi.stubGlobal("caches", mockCacheStorage);
  });

  describe("initialization", () => {
    it("should create an instance with default options", () => {
      const cache = new SocketCache(defaults);
      expect(cache).toBeDefined();
      expect(cache.value).toBeUndefined();
    });

    it("should not throw for edge-case option values", () => {
      expect(
        () =>
          new SocketCache({ ...defaults, disableCache: true, maxCacheAge: 0 })
      ).not.toThrow();
    });
  });

  describe("value", () => {
    it("should be undefined before any data is set", () => {
      const cache = new SocketCache(defaults);
      expect(cache.value).toBeUndefined();
    });

    it("should return the last stored state after set", async () => {
      const cache = new SocketCache(defaults);
      await cache.set("/path", JSON.stringify({ count: 1 }));
      expect(cache.value).toEqual({ count: 1 });
    });

    it("should reflect the most recent set call", async () => {
      const cache = new SocketCache(defaults);
      await cache.set("/path", JSON.stringify({ count: 1 }));
      await cache.set("/path", JSON.stringify({ count: 2 }));
      expect(cache.value).toEqual({ count: 2 });
    });
  });

  describe("subscribe", () => {
    it("should notify observers when data is set", async () => {
      const cache = new SocketCache(defaults);
      const observer = vi.fn();

      cache.subscribe(observer);
      await cache.set("/path", JSON.stringify({ message: "hello" }));

      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith({ message: "hello" });
    });

    it("should notify all subscribed observers", async () => {
      const cache = new SocketCache(defaults);
      const a = vi.fn();
      const b = vi.fn();

      cache.subscribe(a);
      cache.subscribe(b);
      await cache.set("/path", JSON.stringify({ value: 42 }));

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("should notify observers with the latest state on each set", async () => {
      const cache = new SocketCache(defaults);
      const observer = vi.fn();

      cache.subscribe(observer);
      await cache.set("/path", JSON.stringify({ step: 1 }));
      await cache.set("/path", JSON.stringify({ step: 2 }));

      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer).toHaveBeenNthCalledWith(1, { step: 1 });
      expect(observer).toHaveBeenNthCalledWith(2, { step: 2 });
    });
  });

  describe("decrypt", () => {
    it("should return data unchanged when no decrypt function is provided", () => {
      const cache = new SocketCache(defaults);
      expect(cache.decrypt({ key: "value" })).toEqual({ key: "value" });
    });

    it("should apply the decrypt function when configured", () => {
      const decrypt = vi.fn((data: unknown) => ({ decrypted: data }));
      const cache = new SocketCache({ ...defaults, decrypt });
      cache.decrypt({ key: "secret" });
      expect(decrypt).toHaveBeenCalledWith({ key: "secret" });
    });

    it("should skip decrypt when decryptData is false", () => {
      const decrypt = vi.fn((data: unknown) => data);
      const cache = new SocketCache({
        ...defaults,
        decrypt,
        decryptData: false,
      });
      cache.decrypt({ key: "value" });
      expect(decrypt).not.toHaveBeenCalled();
    });
  });

  describe("setStateAction", () => {
    it("should transform data through setStateAction", async () => {
      const setStateAction = vi.fn((next: unknown) => next);
      const cache = new SocketCache({ ...defaults, setStateAction });

      await cache.set("/path", JSON.stringify({ value: 10 }));

      expect(setStateAction).toHaveBeenCalledWith({ value: 10 }, undefined);
    });

    it("should pass current state as second argument to setStateAction", async () => {
      const setStateAction = vi.fn((next: unknown) => next);
      const cache = new SocketCache({ ...defaults, setStateAction });

      await cache.set("/path", JSON.stringify({ value: 1 }));
      await cache.set("/path", JSON.stringify({ value: 2 }));

      expect(setStateAction).toHaveBeenNthCalledWith(
        2,
        { value: 2 },
        { value: 1 }
      );
    });

    it("should store the result of setStateAction", async () => {
      const setStateAction = (next: { value: number }) => ({
        value: next.value * 2,
      });
      const cache = new SocketCache({ ...defaults, setStateAction });

      await cache.set("/path", JSON.stringify({ value: 5 }));
      expect(cache.value).toEqual({ value: 10 });
    });
  });

  describe("Functional Cache API Interactions", () => {
    beforeEach(() => {
      SocketCache.isAvailable = true;
    });

    afterEach(() => {
      SocketCache.isAvailable = "caches" in globalThis;
    });

    it("should write data to Cache Storage on set", async () => {
      const cache = new SocketCache(defaults);
      await cache.initialize("/items");
      await cache.set("/items", JSON.stringify({ ok: true }));

      expect(mockCacheStorage.open).toHaveBeenCalled();
      expect(mockCache.put).toHaveBeenCalledWith(
        expect.stringContaining("/items"),
        expect.any(Response)
      );
    });

    it("should read valid data from Cache Storage during initialize", async () => {
      const expiresAt = new Date(Date.now() + 3600000).toUTCString();
      const mockResponse = new Response(JSON.stringify({ fromCache: true }), {
        headers: { Expires: expiresAt },
      });
      mockCache.match.mockResolvedValue(mockResponse);

      const cache = new SocketCache(defaults);
      const observer = vi.fn();
      cache.subscribe(observer);

      await cache.initialize("/items");

      expect(cache.value).toEqual({ fromCache: true });
      expect(observer).toHaveBeenCalledWith({ fromCache: true });
    });
  });

  describe("Cache API Error Handling Fallbacks", () => {
    beforeEach(() => {
      // Force environment to look exactly like pure jsdom with missing cache
      vi.stubGlobal("caches", undefined);
    });

    it("get should return undefined when cache is unavailable", async () => {
      const cache = new SocketCache(defaults);
      await expect(cache.get("/path")).resolves.toBeUndefined();
    });

    it("has should return false when cache is unavailable", async () => {
      const cache = new SocketCache(defaults);
      await expect(cache.has("/path")).resolves.toBe(false);
    });

    it("clear should be a no-op when cache is unavailable", async () => {
      const cache = new SocketCache(defaults);
      await expect(cache.clear()).resolves.toBeUndefined();
    });

    it("remove should return false when cache is unavailable", async () => {
      const cache = new SocketCache(defaults);
      await expect(cache.remove("/path")).resolves.toBe(false);
    });
  });

  describe("disableCache", () => {
    it("should still update in-memory state when cache is disabled", async () => {
      const cache = new SocketCache({ ...defaults, disableCache: true });
      await cache.set("/path", JSON.stringify({ cached: false }));
      expect(cache.value).toEqual({ cached: false });
    });

    it("should still notify observers when cache is disabled", async () => {
      const cache = new SocketCache({ ...defaults, disableCache: true });
      const observer = vi.fn();
      cache.subscribe(observer);
      await cache.set("/path", JSON.stringify({ notified: true }));
      expect(observer).toHaveBeenCalledWith({ notified: true });
    });

    it("should completely bypass cache API calls when disabled", async () => {
      const cache = new SocketCache({ ...defaults, disableCache: true });
      await cache.set("/path", JSON.stringify({ data: 1 }));

      expect(mockCacheStorage.open).not.toHaveBeenCalled();
    });
  });

  describe("storage backend", () => {
    it("reports no persistence when Cache Storage is unavailable", async () => {
      vi.stubGlobal("caches", undefined);
      const cache = new SocketCache(defaults);

      await cache.initialize("/path");

      expect(cache.persistence).toBe("none");
    });

    it("uses an in-memory backend when cacheFallback is memory", async () => {
      vi.stubGlobal("caches", undefined);
      const cache = new SocketCache({ ...defaults, fallback: "memory" });

      await cache.initialize("/path");
      await cache.set("/path", JSON.stringify({ count: 7 }));

      expect(cache.persistence).toBe("memory");
      await expect(cache.get("/path")).resolves.toEqual({ count: 7 });
    });

    it("does not persist a memory fallback across instances", async () => {
      vi.stubGlobal("caches", undefined);
      const first = new SocketCache({ ...defaults, fallback: "memory" });
      await first.initialize("/path");
      await first.set("/path", JSON.stringify({ count: 1 }));

      const second = new SocketCache({ ...defaults, fallback: "memory" });
      await second.initialize("/path");

      // Memory caching is explicitly not the same guarantee as Cache Storage.
      expect(second.value).toBeUndefined();
      expect(second.persistence).toBe("memory");
    });

    it("reports cache-storage when Cache Storage is available", async () => {
      const cache = new SocketCache(defaults);

      await cache.initialize("/path");

      expect(cache.persistence).toBe("cache-storage");
    });

    it("prefers an injected caches adapter over the global", async () => {
      vi.stubGlobal("caches", undefined);
      const cache = new SocketCache({
        ...defaults,
        runtime: { caches: mockCacheStorage as unknown as CacheStorage },
      });

      await cache.initialize("/path");

      expect(cache.persistence).toBe("cache-storage");
      expect(mockCacheStorage.open).toHaveBeenCalledWith(defaults.origin);
    });

    it("stays at none when caching is disabled, even with a fallback", async () => {
      const cache = new SocketCache({
        ...defaults,
        disableCache: true,
        fallback: "memory",
      });

      await cache.initialize("/path");

      expect(cache.persistence).toBe("none");
    });
  });

  describe("stored copy", () => {
    // A Cache Storage that keeps its stores in maps, as a browser would.
    const createStorage = () => {
      const stores = new Map<string, Map<string, Response>>();
      const storage = {
        stores,
        delete: vi.fn(async (name: string) => stores.delete(name)),
        open: vi.fn(async (name: string) => {
          const entries = stores.get(name) ?? new Map<string, Response>();
          stores.set(name, entries);
          return {
            delete: async (path: string) => entries.delete(path),
            keys: async () => [...entries.keys()],
            match: async (path: string) => entries.get(path)?.clone(),
            put: async (path: string, response: Response) => {
              entries.set(path, response.clone());
            },
          };
        }),
      };
      vi.stubGlobal("caches", storage);
      return storage;
    };

    const entry = (body: unknown, expires: number) =>
      new Response(JSON.stringify(body), {
        headers: { Expires: new Date(expires).toUTCString() },
      });

    const encrypt = (data: unknown) => ({ sealed: JSON.stringify(data) });
    const decrypt = (data: unknown) =>
      JSON.parse((data as { sealed: string }).sealed);

    it("holds the readable state and stores the encrypted one", async () => {
      const storage = createStorage();
      const cache = new SocketCache<{ count: number }>({
        ...defaults,
        decryptData: false,
        decrypt,
        encrypt,
        setStateAction: (next, current) => ({
          count: (current?.count ?? 0) + next.count,
        }),
      });
      await cache.initialize("/items");

      await cache.set("/items", JSON.stringify({ count: 1 }));
      await cache.set("/items", JSON.stringify({ count: 2 }));

      const stored = storage.stores.get(defaults.origin)!.get("/items")!;
      expect(cache.value).toEqual({ count: 3 });
      expect(stored.headers.get("X-Socket-Cache-Encoding")).toBe("cipher");
      expect(await stored.clone().json()).toEqual(encrypt({ count: 3 }));
      await expect(cache.get("/items")).resolves.toEqual({ count: 3 });
    });

    it("encrypts the stored copy without a reducer too", async () => {
      const storage = createStorage();
      const cache = new SocketCache({
        ...defaults,
        decryptData: false,
        decrypt,
        encrypt,
      });
      await cache.initialize("/items");

      await cache.set("/items", JSON.stringify({ secret: 1 }));

      const stored = storage.stores.get(defaults.origin)!.get("/items")!;
      expect(cache.value).toEqual({ secret: 1 });
      expect(await stored.clone().json()).toEqual(encrypt({ secret: 1 }));
    });

    it("reads a reduced state back without decrypting it", async () => {
      createStorage();
      const cache = new SocketCache<{ count: number }>({
        ...defaults,
        decrypt,
        setStateAction: (next) => next,
      });
      await cache.initialize("/items");

      await cache.set("/items", JSON.stringify(encrypt({ count: 4 })));

      expect(cache.value).toEqual({ count: 4 });
      await expect(cache.get("/items")).resolves.toEqual({ count: 4 });
    });

    it("deletes the named store on clear, and stores again after", async () => {
      const storage = createStorage();
      const cache = new SocketCache(defaults);
      await cache.initialize("/items");
      await cache.set("/items", JSON.stringify({ count: 1 }));

      await cache.clear();

      expect(storage.stores.has(defaults.origin)).toBe(false);
      expect(cache.value).toEqual({ count: 1 });

      await cache.set("/items", JSON.stringify({ count: 2 }));
      await expect(cache.get("/items")).resolves.toEqual({ count: 2 });
    });

    it("reads an entry stored before the header as a message", async () => {
      const storage = createStorage();
      const store = await storage.open(defaults.origin);
      await store.put("/items", entry(encrypt({ old: true }), Date.now() + 1000));
      const cache = new SocketCache({ ...defaults, decrypt });

      await cache.initialize("/items");

      expect(cache.value).toEqual({ old: true });
    });
  });
});

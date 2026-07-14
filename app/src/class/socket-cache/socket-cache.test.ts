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
  let mockCacheStorage: any;
  let mockCache: any;

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
      const setStateAction = vi.fn((next: unknown, _current?: unknown) => next);
      const cache = new SocketCache({ ...defaults, setStateAction });

      await cache.set("/path", JSON.stringify({ value: 10 }));

      expect(setStateAction).toHaveBeenCalledWith({ value: 10 }, undefined);
    });

    it("should pass current state as second argument to setStateAction", async () => {
      const setStateAction = vi.fn((next: unknown, current?: unknown) => next);
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
      const setStateAction = (next: any) => ({ value: next.value * 2 });
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
});

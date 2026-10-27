import { afterEach, describe, expect, it, vi } from "vitest";
import { getCacheStorage } from "./index";

describe("getCacheStorage", () => {
  const injected = {} as CacheStorage;
  const ambient = {} as CacheStorage;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the injected Cache Storage", () => {
    vi.stubGlobal("caches", ambient);
    expect(getCacheStorage({ caches: injected })).toBe(injected);
  });

  it("falls back to the ambient Cache Storage", () => {
    vi.stubGlobal("caches", ambient);
    expect(getCacheStorage()).toBe(ambient);
  });

  it("returns undefined where the runtime has none", () => {
    vi.stubGlobal("caches", undefined);
    expect(getCacheStorage()).toBeUndefined();
  });
});

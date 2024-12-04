import { describe, expect, it } from "vitest";
import { extractOrigin } from "./index";

describe("extractOrigin", () => {
  it("should return the origin of a valid URL", () => {
    const url = "https://example.com/path/to/resource";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com");
  });

  it("should handle URLs without a path", () => {
    const url = "https://example.com";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com");
  });

  it("should handle URLs with ports", () => {
    const url = "https://example.com:8080/path/to/resource";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com:8080");
  });

  it("should handle URLs with query parameters", () => {
    const url = "https://example.com/path?query=param";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com");
  });

  it("should handle URLs with fragments", () => {
    const url = "https://example.com/path#fragment";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com");
  });

  it("should return the input if URL constructor is not available", () => {
    const originalURL = global.URL;
    // @ts-ignore
    global.URL = undefined;
    const url = "https://example.com/path/to/resource";
    const result = extractOrigin(url);
    expect(result).toBe("https://example.com");
    global.URL = originalURL;
  });
});

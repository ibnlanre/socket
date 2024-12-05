import { describe, expect, it } from "vitest";
import { extractPathname } from "./index";

describe("extractPathname", () => {
  it("should extract pathname from a valid URL", () => {
    const url = "https://example.com/path/to/resource";
    const result = extractPathname(url);
    expect(result).toBe("/path/to/resource");
  });

  it("should handle URLs without a pathname", () => {
    const url = "https://example.com";
    const result = extractPathname(url);
    expect(result).toBe("/");
  });

  it("should handle invalid URLs by splitting the string", () => {
    const url = "invalid-url/path/to/resource";
    const result = extractPathname(url);
    expect(result).toBe("resource");
  });

  it("should handle URLs with query parameters", () => {
    const url = "https://example.com/path/to/resource?query=param";
    const result = extractPathname(url);
    expect(result).toBe("/path/to/resource?query=param");
  });

  it("should handle URLs with hash fragments", () => {
    const url = "https://example.com/path/to/resource#fragment";
    const result = extractPathname(url);
    expect(result).toBe("/path/to/resource#fragment");
  });
});

import { describe, it, expect } from "vitest";
import { combineURLs } from ".";

describe("combineURLs", () => {
  it("should combine a base URL and a relative URL", () => {
    expect(combineURLs("https://example.com/", "/api")).toBe(
      "https://example.com/api"
    );
  });

  it("should remove trailing slashes from the base URL", () => {
    expect(combineURLs("https://example.com///", "/api")).toBe(
      "https://example.com/api"
    );
  });

  it("should remove leading slashes from the relative URL", () => {
    expect(combineURLs("https://example.com/", "///api")).toBe(
      "https://example.com/api"
    );
  });

  it("should return the base URL if the relative URL is empty", () => {
    expect(combineURLs("https://example.com/", "")).toBe(
      "https://example.com/"
    );
  });

  it("should handle base URLs without trailing slashes", () => {
    expect(combineURLs("https://example.com", "/api")).toBe(
      "https://example.com/api"
    );
  });

  it("should handle relative URLs without leading slashes", () => {
    expect(combineURLs("https://example.com/", "api")).toBe(
      "https://example.com/api"
    );
  });

  it("should handle both base and relative URLs without slashes", () => {
    expect(combineURLs("https://example.com", "api")).toBe(
      "https://example.com/api"
    );
  });
});

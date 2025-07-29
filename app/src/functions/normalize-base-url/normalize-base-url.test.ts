import { describe, expect, it } from "vitest";
import { normalizeBaseURL } from "./index";

describe("normalizeBaseURL", () => {
  it("should return empty string for undefined input", () => {
    expect(normalizeBaseURL(undefined)).toBe("");
  });

  it("should return empty string for null input", () => {
    expect(normalizeBaseURL(null as unknown as string)).toBe("");
  });

  it("should remove trailing slashes from URL", () => {
    expect(normalizeBaseURL("https://example.com/")).toBe(
      "https://example.com"
    );
    expect(normalizeBaseURL("https://example.com///")).toBe(
      "https://example.com"
    );
  });

  it("should not modify URLs without trailing slashes", () => {
    expect(normalizeBaseURL("https://example.com")).toBe("https://example.com");
  });
});

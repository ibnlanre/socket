import { describe, expect, it } from "vitest";
import { isAbsoluteURL } from "./index";

describe("isAbsoluteURL", () => {
  it('should return true for URLs starting with "http://"', () => {
    expect(isAbsoluteURL("http://example.com")).toBe(true);
  });

  it('should return true for URLs starting with "https://"', () => {
    expect(isAbsoluteURL("https://example.com")).toBe(true);
  });

  it('should return true for protocol-relative URLs starting with "//"', () => {
    expect(isAbsoluteURL("//example.com")).toBe(true);
  });

  it("should return false for URLs without a scheme", () => {
    expect(isAbsoluteURL("example.com")).toBe(false);
  });

  it("should return false for strings that are not URLs", () => {
    expect(isAbsoluteURL("example")).toBe(false);
  });

  it('should return true for URLs starting with "ftp://"', () => {
    expect(isAbsoluteURL("ftp://example.com")).toBe(true);
  });

  it("should return false for empty strings", () => {
    expect(isAbsoluteURL("")).toBe(false);
  });

  it("should return false for URLs with invalid schemes", () => {
    expect(isAbsoluteURL("1http://example.com")).toBe(false);
  });
});

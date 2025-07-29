import { describe, expect, it } from "vitest";
import { normalizeRelativeURL } from "./index";

describe("normalizeRelativeURL", () => {
  it("returns empty string for undefined input", () => {
    expect(normalizeRelativeURL()).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(normalizeRelativeURL("")).toBe("");
  });

  it("removes leading slash", () => {
    expect(normalizeRelativeURL("/api")).toBe("api");
  });

  it("removes multiple leading slashes", () => {
    expect(normalizeRelativeURL("///api")).toBe("api");
  });

  it("keeps trailing slashes", () => {
    expect(normalizeRelativeURL("/api/")).toBe("api/");
  });

  it("returns original string if no leading slashes", () => {
    expect(normalizeRelativeURL("api")).toBe("api");
  });
});

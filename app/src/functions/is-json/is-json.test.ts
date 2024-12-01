import { describe, expect, it } from "vitest";
import { isJSON } from "./index";

describe("isJSON", () => {
  it("should return true for defined values", () => {
    expect(isJSON(1)).toBe(true);
    expect(isJSON("string")).toBe(true);
    expect(isJSON(true)).toBe(true);
    expect(isJSON({})).toBe(true);
    expect(isJSON([])).toBe(true);
    expect(isJSON(null)).toBe(true);
  });

  it("should return false for undefined values", () => {
    expect(isJSON(undefined)).toBe(false);
  });
});

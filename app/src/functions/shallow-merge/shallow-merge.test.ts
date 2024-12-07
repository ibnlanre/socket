import { describe, expect, it } from "vitest";
import { shallowMerge } from "./index";

describe("shallowMerge", () => {
  it("should merge properties from source to target", () => {
    const target = { a: 1 };
    const source = { b: 2 };
    const result = shallowMerge(target, source);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should override properties in target with properties from source", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3 };
    const result = shallowMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it("should not modify the source object", () => {
    const target = { a: 1 };
    const source = { b: 2 };
    shallowMerge(target, source);
    expect(source).toEqual({ b: 2 });
  });

  it("should not modify the target object", () => {
    const target = { a: 1 };
    const source = { b: 2 };
    shallowMerge(target, source);
    expect(target).toEqual({ a: 1, b: 2 });
  });

  it("should handle empty target object", () => {
    const target = {};
    const source = { a: 1 };
    const result = shallowMerge(target, source);
    expect(result).toEqual({ a: 1 });
  });

  it("should handle empty source object", () => {
    const target = { a: 1 };
    const source = {};
    const result = shallowMerge(target, source);
    expect(result).toEqual({ a: 1 });
  });

  it("should handle both empty target and source objects", () => {
    const target = {};
    const source = {};
    const result = shallowMerge(target, source);
    expect(result).toEqual({});
  });
});

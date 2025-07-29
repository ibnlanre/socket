import { describe, expect, it } from "vitest";
import { shallowClone } from "./index";

describe("shallowClone", () => {
  it("should create a shallow clone of an object", () => {
    const obj = { a: 1, b: 2 };
    const clone = shallowClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  it("should preserve the prototype of the original object", () => {
    class MyClass {
      a = 1;
    }
    const obj = new MyClass();
    const clone = shallowClone(obj);
    expect(Object.getPrototypeOf(clone)).toBe(MyClass.prototype);
  });

  it("should copy property descriptors", () => {
    const obj = {};
    Object.defineProperty(obj, "a", {
      value: 1,
      writable: false,
      enumerable: true,
      configurable: true,
    });
    const clone = shallowClone(obj);
    const descriptor = Object.getOwnPropertyDescriptor(clone, "a");
    expect(descriptor).toEqual({
      value: 1,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  });

  it("should handle objects with getters", () => {
    const obj = {
      get a() {
        return 1;
      },
    };
    const clone = shallowClone(obj);
    const descriptor = Object.getOwnPropertyDescriptor(clone, "a");
    expect(descriptor?.get).toBeDefined();
    expect(clone.a).toBe(1);
  });

  it("should handle empty objects", () => {
    const obj = {};
    const clone = shallowClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  it("should handle objects with symbol properties", () => {
    const sym = Symbol("a");
    const obj = { [sym]: 1 };
    const clone = shallowClone(obj);
    expect(clone[sym]).toBe(1);
    expect(clone).not.toBe(obj);
  });
});

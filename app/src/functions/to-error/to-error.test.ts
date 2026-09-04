import { describe, expect, it } from "vitest";

import { toError } from "./index";

describe("toError", () => {
  it("should pass through existing Error instances", () => {
    const error = new Error("boom");
    expect(toError(error)).toBe(error);
  });

  it("should wrap non-Error values with their string form as the message", () => {
    const failure = toError("socket exploded");

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe("socket exploded");
    expect(failure.cause).toBe("socket exploded");
  });

  it("should honor an explicit message and keep the original as cause", () => {
    const value = { code: 503 };
    const failure = toError(value, "EventSource connection failed");

    expect(failure.message).toBe("EventSource connection failed");
    expect(failure.cause).toBe(value);
  });

  it("should handle null and undefined values", () => {
    expect(toError(undefined).message).toBe("undefined");
    expect(toError(null).cause).toBeNull();
  });
});

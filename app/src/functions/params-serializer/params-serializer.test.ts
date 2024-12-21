import type { ConnectionParams } from "@/types/connection-params";

import { describe, expect, it } from "vitest";
import { paramsSerializer } from "./index";

describe("paramsSerializer", () => {
  expect.extend({
    decodedToBe(received: string, expected: string) {
      const pass = decodeURIComponent(received) === expected;
      return {
        pass,
        message: () => `expected ${pass ? "not " : ""}to be ${expected}`,
      };
    },
  });

  it("should serialize simple key-value pairs", () => {
    const params: ConnectionParams = { foo: "bar", baz: "qux" };
    const result = paramsSerializer(params);
    expect(result).toBe("foo=bar&baz=qux");
  });

  it("should ignore empty values", () => {
    const params: ConnectionParams = { foo: "", baz: "qux" };
    const result = paramsSerializer(params);
    expect(result).toBe("baz=qux");
  });

  it("should ignore null values", () => {
    const params: ConnectionParams = { foo: null, baz: "qux" };
    const result = paramsSerializer(params);
    expect(result).toBe("baz=qux");
  });

  it("should ignore undefined values", () => {
    const params: ConnectionParams = { foo: undefined, baz: "qux" };
    const result = paramsSerializer(params);
    expect(result).toBe("baz=qux");
  });

  it("should serialize array values", () => {
    const params: ConnectionParams = { foo: ["bar", "baz"], qux: "quux" };
    const result = paramsSerializer(params);
    expect(result).toBe("foo=bar&foo=baz&qux=quux");
  });

  it("should encode special characters", () => {
    const params: ConnectionParams = { foo: "bar baz", qux: "quux&corge" };
    const result = paramsSerializer(params);
    expect(decodeURIComponent(result)).toBe("foo=bar%20baz&qux=quux%26corge");
  });

  it("should handle custom ignore values", () => {
    const params: ConnectionParams = { foo: "bar", baz: null, qux: "quux" };
    const result = paramsSerializer(params, ["null"]);
    expect(result).toBe("foo=bar&qux=quux");
  });
});

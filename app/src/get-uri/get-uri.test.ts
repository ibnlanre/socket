import type { SocketURI } from "@/types/socket-uri";

import { describe, expect, it } from "vitest";
import { getUri } from ".";

describe("getUri", () => {
  it("should return the base URL correctly", () => {
    const uri: SocketURI = { url: "http://base.com" };
    expect(getUri(uri)).toBe("http://base.com/");
  });

  it("should return the URL when given an absolute URL", () => {
    const uri: SocketURI = {
      url: "http://example.com",
      baseURL: "http://base.com",
    };
    expect(getUri(uri)).toBe("http://example.com/");
  });

  it("should combine baseURL and url when given a relative URL", () => {
    const uri: SocketURI = { url: "/path", baseURL: "http://base.com/" };
    expect(getUri(uri)).toBe("http://base.com/path");
  });

  it("should return the full URL without params if params are not provided", () => {
    const uri: SocketURI = { url: "/path", baseURL: "http://base.com" };
    expect(getUri(uri)).toBe("http://base.com/path");
  });

  it("should append serialized params to the URL", () => {
    const uri: SocketURI = {
      url: "/path",
      baseURL: "http://base.com",
      params: { key: "value" },
    };
    expect(getUri(uri)).toBe("http://base.com/path?key=value");
  });

  it("should handle multiple params correctly", () => {
    const uri: SocketURI = {
      url: "/path",
      baseURL: "http://base.com",
      params: { key1: "value1", key2: "value2" },
    };
    expect(getUri(uri)).toBe("http://base.com/path?key1=value1&key2=value2");
  });

  it("should handle empty params object correctly", () => {
    const uri: SocketURI = {
      url: "/path",
      baseURL: "http://base.com",
      params: {},
    };
    expect(getUri(uri)).toBe("http://base.com/path");
  });
});

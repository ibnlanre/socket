import { describe, expect, it } from "vitest";

import { isExpired } from "./index";

describe("isExpired", () => {
  const now = Date.UTC(2026, 9, 27, 12);
  const expiring = (expires: string) =>
    new Response(null, { headers: { Expires: expires } });

  it("is false before Expires", () => {
    expect(isExpired(expiring(new Date(now + 1000).toUTCString()), now)).toBe(
      false
    );
  });

  it("is true after Expires", () => {
    expect(isExpired(expiring(new Date(now - 1000).toUTCString()), now)).toBe(
      true
    );
  });

  it("is true without Expires, or with one that is not a date", () => {
    expect(isExpired(new Response(null), now)).toBe(true);
    expect(isExpired(expiring("soon"), now)).toBe(true);
  });
});

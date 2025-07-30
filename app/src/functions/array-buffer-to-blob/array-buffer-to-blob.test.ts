import { describe, expect, it } from "vitest";
import { arrayBufferToBlob } from "./index";

describe("arrayBufferToBlob", () => {
  it("should convert ArrayBuffer to Blob with application/json type", () => {
    const data = JSON.stringify({ test: "data" });
    const buffer = new TextEncoder().encode(data).buffer;
    const blob = arrayBufferToBlob(buffer);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("should handle empty ArrayBuffer", () => {
    const emptyBuffer = new ArrayBuffer(0);
    const blob = arrayBufferToBlob(emptyBuffer);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBe(0);
  });
});

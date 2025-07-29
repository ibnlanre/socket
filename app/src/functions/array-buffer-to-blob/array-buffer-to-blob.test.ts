import { describe, expect, it } from "vitest";
import { arrayBufferToBlob } from "./index";

describe("arrayBufferToBlob", () => {
  it("should convert ArrayBuffer to Blob with application/json type", () => {
    // Create sample ArrayBuffer
    const data = JSON.stringify({ test: "data" });
    const buffer = new TextEncoder().encode(data).buffer;

    // Convert to Blob
    const blob = arrayBufferToBlob(buffer);

    // Assert blob type
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");

    // Assert blob content
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

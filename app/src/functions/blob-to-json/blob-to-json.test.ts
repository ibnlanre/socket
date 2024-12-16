import { describe, expect, it, vi, vitest } from "vitest";
import { blobToJson } from "./index";

describe("blobToJson", () => {
  it("should resolve with the correct JSON string", async () => {
    const json = JSON.stringify({ key: "value" });
    const blob = new Blob([json], { type: "application/json" });

    const result = await blobToJson(blob);
    expect(result).toBe(json);
  });

  it("should reject if the blob is not valid JSON", async () => {
    const invalidJson = "invalid json";
    const blob = new Blob([invalidJson], { type: "application/json" });

    await expect(blobToJson(blob)).rejects.toThrow();
  });

  // it("should reject if there is an error reading the blob", async () => {
  //   const blob = new Blob([""], { type: "application/json" });

  //   // Mock FileReader to throw an error
  //   const originalFileReader = global.FileReader;
  //   global.FileReader = class {
  //     onload: () => void = () => {};
  //     onerror: () => void = () => {};
  //     readAsText() {
  //       this.onerror(new Error("FileReader error"));
  //     }
  //   } as any;

  //   global.FileReader = vi.fn(() => ({
  //     readyState: 0,
  //     close: vi.fn(),
  //   })) as any;

  //   await expect(blobToJson(blob)).rejects.toThrow("FileReader error");

  //   // Restore original FileReader
  //   global.FileReader = originalFileReader;
  // });
});

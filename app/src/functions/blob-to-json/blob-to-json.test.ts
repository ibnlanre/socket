import { describe, expect, it } from "vitest";
import { blobToJson } from "./index";

describe("blobToJson", () => {
  it("should resolve with the correct JSON string", async () => {
    const json = JSON.stringify({ key: "value" });
    const blob = new Blob([json], { type: "application/json" });

    const result = await blobToJson(blob);
    expect(result).toBe(json);
  });

  it("should read invalid json as text", async () => {
    const invalidJson = "invalid json";
    const blob = new Blob([invalidJson], { type: "application/json" });

    const result = await blobToJson(blob);
    expect(result).toBe(invalidJson);
  });
});

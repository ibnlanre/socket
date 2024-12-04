import { describe, expect, it } from "vitest";
import { toMs } from "./index";

describe("toMs", () => {
  it("should return the number if it is a number", () => {
    expect(toMs(1000)).toBe(1000);
  });

  it("should convert years to milliseconds", () => {
    expect(toMs("1y")).toBe(31557600000);
    expect(toMs("1year")).toBe(31557600000);
    expect(toMs("1 year")).toBe(31557600000);
    expect(toMs("1.0yr")).toBe(31557600000);
  });

  it("should convert months to milliseconds", () => {
    expect(toMs("1mo")).toBe(2629800000);
    expect(toMs("1month")).toBe(2629800000);
    expect(toMs("1 month")).toBe(2629800000);
    expect(toMs("1.0mth")).toBe(2629800000);
  });

  it("should convert weeks to milliseconds", () => {
    expect(toMs("1w")).toBe(604800000);
    expect(toMs("1week")).toBe(604800000);
    expect(toMs("1 week")).toBe(604800000);
    expect(toMs("1.0wk")).toBe(604800000);
  });

  it("should convert days to milliseconds", () => {
    expect(toMs("1d")).toBe(86400000);
    expect(toMs("1day")).toBe(86400000);
    expect(toMs("1 day")).toBe(86400000);
    expect(toMs("1.0dy")).toBe(86400000);
  });

  it("should convert hours to milliseconds", () => {
    expect(toMs("1h")).toBe(3600000);
    expect(toMs("1hour")).toBe(3600000);
    expect(toMs("1 hour")).toBe(3600000);
    expect(toMs("1.0hr")).toBe(3600000);
  });

  it("should convert minutes to milliseconds", () => {
    expect(toMs("1m")).toBe(60000);
    expect(toMs("1minute")).toBe(60000);
    expect(toMs("1 minute")).toBe(60000);
    expect(toMs("1.0min")).toBe(60000);
  });

  it("should convert seconds to milliseconds", () => {
    expect(toMs("1s")).toBe(1000);
    expect(toMs("1second")).toBe(1000);
    expect(toMs("1 second")).toBe(1000);
    expect(toMs("1.0sec")).toBe(1000);
  });
});

import { describe, expect, it } from "vitest";
import { time } from "./index";

describe("time", () => {
  it("should return the number if it is a number", () => {
    expect(time(1000)).toBe(1000);
    expect(time(1000.0)).toBe(1000);
    expect(time(-1000)).toBe(-1000);
  });

  it("should return the number if it is a string", () => {
    expect(time(<any>"1000")).toBe(1000);
    expect(time(<any>"1000i")).toBe(1000);
    expect(time(<any>"-1000")).toBe(-1000);
  });

  it("should convert years to milliseconds", () => {
    expect(time("1y")).toBe(31557600000);
    expect(time("1Year")).toBe(31557600000);
    expect(time("1 YEAR")).toBe(31557600000);
    expect(time("1.0yr")).toBe(31557600000);
    expect(time("2 years")).toBe(63115200000);
    expect(time("-2 years")).toBe(-63115200000);
  });

  it("should convert months to milliseconds", () => {
    expect(time("1mo")).toBe(2629800000);
    expect(time("1Month")).toBe(2629800000);
    expect(time("1 MONTH")).toBe(2629800000);
    expect(time("1.0mth")).toBe(2629800000);
    expect(time("2 months")).toBe(5259600000);
    expect(time("-2 months")).toBe(-5259600000);
  });

  it("should convert weeks to milliseconds", () => {
    expect(time("1w")).toBe(604800000);
    expect(time("1Week")).toBe(604800000);
    expect(time("1 WEEK")).toBe(604800000);
    expect(time("1.0wk")).toBe(604800000);
    expect(time("2 weeks")).toBe(1209600000);
    expect(time("-2 weeks")).toBe(-1209600000);
  });

  it("should convert days to milliseconds", () => {
    expect(time("1d")).toBe(86400000);
    expect(time("1Day")).toBe(86400000);
    expect(time("1 DAY")).toBe(86400000);
    expect(time("1.0dy")).toBe(86400000);
    expect(time("2 days")).toBe(172800000);
    expect(time("-2 days")).toBe(-172800000);
  });

  it("should convert hours to milliseconds", () => {
    expect(time("1h")).toBe(3600000);
    expect(time("1Hour")).toBe(3600000);
    expect(time("1 HOUR")).toBe(3600000);
    expect(time("1.0hr")).toBe(3600000);
    expect(time("2 hours")).toBe(7200000);
    expect(time("-2 hours")).toBe(-7200000);
  });

  it("should convert minutes to milliseconds", () => {
    expect(time("1m")).toBe(60000);
    expect(time("1Minute")).toBe(60000);
    expect(time("1 MINUTE")).toBe(60000);
    expect(time("1.0min")).toBe(60000);
    expect(time("2 minutes")).toBe(120000);
    expect(time("-2 minutes")).toBe(-120000);
  });

  it("should convert seconds to milliseconds", () => {
    expect(time("1s")).toBe(1000);
    expect(time("1Second")).toBe(1000);
    expect(time("1 SECOND")).toBe(1000);
    expect(time("1.0sec")).toBe(1000);
    expect(time("2 seconds")).toBe(2000);
    expect(time("-2 seconds")).toBe(-2000);
  });

  it("should convert milliseconds to milliseconds", () => {
    expect(time("1ms")).toBe(1);
    expect(time("1Millisecond")).toBe(1);
    expect(time("1 MILLISECOND")).toBe(1);
    expect(time("1.0msec")).toBe(1);
    expect(time("2 milliseconds")).toBe(2);
    expect(time("-2 milliseconds")).toBe(-2);
  });

  it("should return Infinity for invalid input", () => {
    expect(time(<any>"invalid")).toBe(Infinity);
    expect(time(<any>"123abc")).toBe(123);
  });

  it("should convert value to specific unit", () => {
    expect(time("1s", "ms")).toBe(1000);
    expect(time("1m", "s")).toBe(60);
    expect(time("1h", "m")).toBe(60);
    expect(time("1d", "h")).toBe(24);
    expect(time("1w", "d")).toBe(7);
    expect(time("1mo", "w")).toBe(4.35);
    expect(time("1yr", "mo")).toBe(12);
  });
});

// 4.345238095238095

import { describe, expect, it } from "vitest";
import { toMs } from "./index";

describe("toMs", () => {
  it("should return the number if it is a number", () => {
    expect(toMs(1000)).toBe(1000);
    expect(toMs(1000.0)).toBe(1000);
    expect(toMs(-1000)).toBe(-1000);
  });

  it("should return the number if it is a string", () => {
    expect(toMs(<any>"1000")).toBe(1000);
    expect(toMs(<any>"1000i")).toBe(1000);
    expect(toMs(<any>"-1000")).toBe(-1000);
  });

  it("should convert years to milliseconds", () => {
    expect(toMs("1y")).toBe(31557600000);
    expect(toMs("1Year")).toBe(31557600000);
    expect(toMs("1 YEAR")).toBe(31557600000);
    expect(toMs("1.0yr")).toBe(31557600000);
    expect(toMs("2 years")).toBe(63115200000);
    expect(toMs("-2 years")).toBe(-63115200000);
  });

  it("should convert months to milliseconds", () => {
    expect(toMs("1mo")).toBe(2629800000);
    expect(toMs("1Month")).toBe(2629800000);
    expect(toMs("1 MONTH")).toBe(2629800000);
    expect(toMs("1.0mth")).toBe(2629800000);
    expect(toMs("2 months")).toBe(5259600000);
    expect(toMs("-2 months")).toBe(-5259600000);
  });

  it("should convert weeks to milliseconds", () => {
    expect(toMs("1w")).toBe(604800000);
    expect(toMs("1Week")).toBe(604800000);
    expect(toMs("1 WEEK")).toBe(604800000);
    expect(toMs("1.0wk")).toBe(604800000);
    expect(toMs("2 weeks")).toBe(1209600000);
    expect(toMs("-2 weeks")).toBe(-1209600000);
  });

  it("should convert days to milliseconds", () => {
    expect(toMs("1d")).toBe(86400000);
    expect(toMs("1Day")).toBe(86400000);
    expect(toMs("1 DAY")).toBe(86400000);
    expect(toMs("1.0dy")).toBe(86400000);
    expect(toMs("2 days")).toBe(172800000);
    expect(toMs("-2 days")).toBe(-172800000);
  });

  it("should convert hours to milliseconds", () => {
    expect(toMs("1h")).toBe(3600000);
    expect(toMs("1Hour")).toBe(3600000);
    expect(toMs("1 HOUR")).toBe(3600000);
    expect(toMs("1.0hr")).toBe(3600000);
    expect(toMs("2 hours")).toBe(7200000);
    expect(toMs("-2 hours")).toBe(-7200000);
  });

  it("should convert minutes to milliseconds", () => {
    expect(toMs("1m")).toBe(60000);
    expect(toMs("1Minute")).toBe(60000);
    expect(toMs("1 MINUTE")).toBe(60000);
    expect(toMs("1.0min")).toBe(60000);
    expect(toMs("2 minutes")).toBe(120000);
    expect(toMs("-2 minutes")).toBe(-120000);
  });

  it("should convert seconds to milliseconds", () => {
    expect(toMs("1s")).toBe(1000);
    expect(toMs("1Second")).toBe(1000);
    expect(toMs("1 SECOND")).toBe(1000);
    expect(toMs("1.0sec")).toBe(1000);
    expect(toMs("2 seconds")).toBe(2000);
    expect(toMs("-2 seconds")).toBe(-2000);
  });

  it("should convert milliseconds to milliseconds", () => {
    expect(toMs("1ms")).toBe(1);
    expect(toMs("1Millisecond")).toBe(1);
    expect(toMs("1 MILLISECOND")).toBe(1);
    expect(toMs("1.0msec")).toBe(1);
    expect(toMs("2 milliseconds")).toBe(2);
    expect(toMs("-2 milliseconds")).toBe(-2);
  });

  it("should return Infinity for invalid input", () => {
    expect(toMs(<any>"invalid")).toBe(Infinity);
    expect(toMs(<any>"123abc")).toBe(123);
  });
});

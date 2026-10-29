import type { TimeUnit, UnitValue } from "@/types/time-unit";

const temporal = {
  get day() {
    return 24 * this.hour;
  },
  get hour() {
    return 60 * this.minute;
  },
  get millisecond() {
    return 1;
  },
  get minute() {
    return 60 * this.second;
  },
  get month() {
    return 30.4375 * this.day;
  },
  get second() {
    return 1000 * this.millisecond;
  },
  get week() {
    return 7 * this.day;
  },
  get year() {
    return 365.25 * this.day;
  },
};

const timeUnitValues: Record<TimeUnit, number> = {
  d: temporal.day,
  day: temporal.day,
  days: temporal.day,
  dy: temporal.day,
  dys: temporal.day,
  h: temporal.hour,
  hour: temporal.hour,
  hours: temporal.hour,
  hr: temporal.hour,
  hrs: temporal.hour,
  m: temporal.minute,
  millisecond: temporal.millisecond,
  milliseconds: temporal.millisecond,
  min: temporal.minute,
  mins: temporal.minute,
  minute: temporal.minute,
  minutes: temporal.minute,
  mo: temporal.month,
  month: temporal.month,
  months: temporal.month,
  mos: temporal.month,
  ms: temporal.millisecond,
  msec: temporal.millisecond,
  msecs: temporal.millisecond,
  mth: temporal.month,
  s: temporal.second,
  sec: temporal.second,
  second: temporal.second,
  seconds: temporal.second,
  secs: temporal.second,
  w: temporal.week,
  week: temporal.week,
  weeks: temporal.week,
  wk: temporal.week,
  wks: temporal.week,
  y: temporal.year,
  year: temporal.year,
  years: temporal.year,
  yr: temporal.year,
  yrs: temporal.year,
};

const units = [
  ["years", "year", "yrs", "yr", "y"],
  ["months", "month", "mos", "mth", "mo"],
  ["weeks", "week", "wks", "wk", "w"],
  ["days", "day", "dys", "dy", "d"],
  ["hours", "hour", "hrs", "hr", "h"],
  ["minutes", "minute", "mins", "min", "m"],
  ["seconds", "second", "secs", "sec", "s"],
  ["milliseconds", "millisecond", "msecs", "msec", "ms"],
].flat();

export function isTimeUnit(value: string): value is TimeUnit {
  return units.includes(value);
}

export function multiplier(value: number, unit: TimeUnit): number {
  return value * timeUnitValues[unit];
}

const numberRegex = /^([+-]?\d+(?:\.\d*)?|\.\d+)\s?/;
const timeUnitRegex = [numberRegex.source, "(", units.join("|"), ")$"];
const timeUnitPattern = new RegExp(timeUnitRegex.join(""), "i");

export function convert(value: number, from: TimeUnit, to: TimeUnit): number {
  const inMilliseconds = multiplier(value, from);
  return inMilliseconds / timeUnitValues[to];
}

export function time(value: UnitValue, to: TimeUnit = "ms"): number {
  if (typeof value === "number") return convert(value, "ms", to);

  const capture = timeUnitPattern.exec(value);

  if (!capture) {
    const number = parseFloat(value);
    return isNaN(number) ? Infinity : convert(number, "ms", to);
  }

  const [, number, unit] = capture;

  if (!unit) return convert(parseFloat(value), "ms", to);
  const timeUnit = unit.toLowerCase() as TimeUnit;

  return toSignificantDigits(convert(+number, timeUnit, to));
}

export function toSignificantDigits(value: number, digits: number = 2): number {
  return parseFloat(value.toFixed(digits));
}

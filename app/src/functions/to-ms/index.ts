import type { TimeUnit, UnitValue } from "@/types/time-unit";

const temporal = {
  get millisecond() {
    return 1;
  },
  get second() {
    return 1000;
  },
  get minute() {
    return this.second * 60;
  },
  get hour() {
    return this.minute * 60;
  },
  get day() {
    return this.hour * 24;
  },
  get week() {
    return this.day * 7;
  },
  get month() {
    return this.day * 30.4375;
  },
  get year() {
    return this.day * 365.25;
  },
};

const timeUnitValues: Record<TimeUnit, number> = {
  y: temporal.year,
  yr: temporal.year,
  yrs: temporal.year,
  year: temporal.year,
  years: temporal.year,
  mo: temporal.month,
  mth: temporal.month,
  mos: temporal.month,
  month: temporal.month,
  months: temporal.month,
  w: temporal.week,
  wk: temporal.week,
  wks: temporal.week,
  week: temporal.week,
  weeks: temporal.week,
  d: temporal.day,
  dy: temporal.day,
  dys: temporal.day,
  day: temporal.day,
  days: temporal.day,
  h: temporal.hour,
  hr: temporal.hour,
  hrs: temporal.hour,
  hour: temporal.hour,
  hours: temporal.hour,
  m: temporal.minute,
  min: temporal.minute,
  mins: temporal.minute,
  minute: temporal.minute,
  minutes: temporal.minute,
  s: temporal.second,
  sec: temporal.second,
  secs: temporal.second,
  second: temporal.second,
  seconds: temporal.second,
  ms: temporal.millisecond,
  msec: temporal.millisecond,
  msecs: temporal.millisecond,
  millisecond: temporal.millisecond,
  milliseconds: temporal.millisecond,
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

export function toMs(value: UnitValue): number {
  if (typeof value === "number") return value;

  const capture = timeUnitPattern.exec(value);

  if (!capture) {
    const number = parseFloat(value);
    return isNaN(number) ? Infinity : number;
  }

  const [, number, unit] = capture;

  if (!unit) return parseFloat(value);
  const timeUnit = <TimeUnit>unit.toLowerCase();

  return Math.round(multiplier(+number, timeUnit));
}

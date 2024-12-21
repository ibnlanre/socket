import type { TimeUnit, UnitValue } from "@/types/time-unit";

const temporal = {
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

export function multiplier(value: number, unit: TimeUnit): number {
  switch (unit) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return value * temporal.year;

    case "months":
    case "month":
    case "mos":
    case "mth":
    case "mo":
      return value * temporal.month;

    case "weeks":
    case "week":
    case "wks":
    case "wk":
    case "w":
      return value * temporal.week;

    case "days":
    case "day":
    case "dys":
    case "dy":
    case "d":
      return value * temporal.day;

    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return value * temporal.hour;

    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return value * temporal.minute;

    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return value * temporal.second;
  }
}

export function toMs(value: UnitValue): number {
  if (typeof value === "number") return value;

  const capture = /^(\d+(?:\.\d+)?)\s?(\w+)$/.exec(value);
  const [match, number, unit] = capture ?? [];
  if (!match) return Infinity;

  const timeUnit = unit.toLowerCase() as TimeUnit;
  return Math.round(multiplier(+number, timeUnit));
}

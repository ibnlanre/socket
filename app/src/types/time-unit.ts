export type TimeUnit = LittleTime | PluralTimeUnit | SingularTimeUnit;

export type Unit = Capitalize<TimeUnit> | TimeUnit | Uppercase<TimeUnit>;

export type UnitValue = `${number}${Unit}` | `${number} ${Unit}` | number;

type LittleTime = "d" | "h" | "m" | "mo" | "ms" | "s" | "w" | "y";

type PluralTime =
  | "days"
  | "hours"
  | "milliseconds"
  | "minutes"
  | "months"
  | "seconds"
  | "weeks"
  | "years";
type PluralTimeUnit = PluralTime | TruncatedPluralTime;
type SingularTime =
  | "day"
  | "hour"
  | "millisecond"
  | "minute"
  | "month"
  | "second"
  | "week"
  | "year";

type SingularTimeUnit = SingularTime | TruncatedSingularTime;
type TruncatedPluralTime =
  | "dys"
  | "hrs"
  | "mins"
  | "mos"
  | "msecs"
  | "secs"
  | "wks"
  | "yrs";
type TruncatedSingularTime =
  | "dy"
  | "hr"
  | "min"
  | "msec"
  | "mth"
  | "sec"
  | "wk"
  | "yr";

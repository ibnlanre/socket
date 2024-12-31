type PluralTime =
  | "milliseconds"
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

type TruncatedPluralTime =
  | "msecs"
  | "secs"
  | "mins"
  | "hrs"
  | "dys"
  | "wks"
  | "mos"
  | "yrs";

type SingularTime =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

type TruncatedSingularTime =
  | "msec"
  | "sec"
  | "min"
  | "hr"
  | "dy"
  | "wk"
  | "mth"
  | "yr";

type LittleTime = "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y";
type SingularTimeUnit = SingularTime | TruncatedSingularTime;
type PluralTimeUnit = PluralTime | TruncatedPluralTime;

export type TimeUnit = LittleTime | SingularTimeUnit | PluralTimeUnit;
export type Unit = TimeUnit | Capitalize<TimeUnit> | Uppercase<TimeUnit>;
export type UnitValue = number | `${number}${Unit}` | `${number} ${Unit}`;

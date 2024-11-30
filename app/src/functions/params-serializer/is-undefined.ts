import type { ExcludedValues } from "@/types/excluded-values";

export function isUndefined(
  value: unknown,
  exclude: ExcludedValues[]
): value is undefined {
  if (!exclude.includes("undefined")) return false;
  return value === undefined;
}

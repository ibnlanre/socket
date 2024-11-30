import type { ExcludedValues } from "@/types/excluded-values";

export function isNull(
  value: unknown,
  exclude: ExcludedValues[]
): value is null {
  if (!exclude.includes("null")) return false;
  return value === null;
}

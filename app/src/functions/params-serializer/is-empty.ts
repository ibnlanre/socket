import type { ExcludedValues } from "@/types/excluded-values";

export function isEmpty(
  value: unknown,
  exclude: ExcludedValues[]
): value is "" {
  if (!exclude.includes("empty")) return false;
  if (typeof value !== "string") return false;
  return value.trim() === "";
}

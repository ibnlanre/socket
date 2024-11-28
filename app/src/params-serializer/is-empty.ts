import type { Ignore } from "@/types/ignore";

export function isEmpty(value: unknown, ignore: Ignore[]): value is "" {
  if (!ignore.includes("empty")) return false;
  if (typeof value !== "string") return false;
  return value.trim() === "";
}

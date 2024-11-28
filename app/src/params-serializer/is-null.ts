import type { Ignore } from "@/types/ignore";

export function isNull(value: unknown, ignore: Ignore[]): value is null {
  if (!ignore.includes("null")) return false;
  return value === null;
}

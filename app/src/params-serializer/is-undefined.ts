import type { Ignore } from "@/types/ignore";

export function isUndefined(
  value: unknown,
  ignore: Ignore[]
): value is undefined {
  if (!ignore.includes("undefined")) return false;
  return value === undefined;
}

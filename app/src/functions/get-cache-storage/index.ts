import type { RuntimeAdapters } from "@/types/runtime";

/** The injected Cache Storage, else the ambient one, if the runtime has it. */
export function getCacheStorage(
  runtime?: RuntimeAdapters
): CacheStorage | undefined {
  if (runtime?.caches) return runtime.caches;
  if (typeof caches === "undefined") return;
  return caches;
}

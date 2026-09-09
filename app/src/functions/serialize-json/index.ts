/** Canonical JSON identity: object order is irrelevant; array order is not. */
export function serializeJSON(value: unknown): string {
  const result = JSON.stringify(value, (_, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, item[key]])
    );
  });
  if (result === undefined) throw new TypeError("Expected a JSON payload.");
  return result;
}

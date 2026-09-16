/** Canonical JSON identity: object order is irrelevant; array order is not. */
export function serializeJSON(value: unknown): string {
  // The replacer's key argument is required positionally but not needed here.
  const result = JSON.stringify(value, (key, item) => {
    void key;
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

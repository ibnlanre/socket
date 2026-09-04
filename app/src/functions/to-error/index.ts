/**
 * Normalize an unknown thrown value into an `Error`.
 *
 * Values that are already `Error` instances pass through untouched so their
 * identity, message, and stack are preserved. Anything else is wrapped in an
 * `Error` whose message defaults to the value's string form, with the original
 * value attached as `cause` for debugging. Pass an explicit `message` when the
 * context deserves a clearer description than the raw value (e.g. a network
 * layer wrapping an opaque failure).
 */
export function toError(value: unknown, message = String(value)): Error {
  return value instanceof Error ? value : new Error(message, { cause: value });
}

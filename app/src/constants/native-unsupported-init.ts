/**
 * `RequestInit` fields a native `EventSource` cannot express. Supplying any of
 * them disqualifies the native transport under `"auto"` and is an error under
 * `"native"`, so configuration is never silently discarded.
 */
export const NativeUnsupportedInit: readonly (keyof RequestInit)[] = [
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "integrity",
  "keepalive",
  "window",
];

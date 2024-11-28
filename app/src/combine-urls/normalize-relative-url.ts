/**
 * Remove leading slashes from the relativeURL
 *
 * @example
 * "/api" => "api"
 */
export function normalizeRelativeURL(relativeURL?: string): string {
  if (!relativeURL) return "";
  return relativeURL.replace(/^\/+/, "");
}

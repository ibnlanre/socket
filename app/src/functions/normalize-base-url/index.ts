/**
 * Remove trailing slashes from the baseURL
 *
 * @example
 * "https://example.com/" => "https://example.com"
 */
export function normalizeBaseURL(baseURL?: string): string {
  if (!baseURL) return "";
  return baseURL.replace(/\/+$/, "");
}

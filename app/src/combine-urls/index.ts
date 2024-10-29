/**
 * Combine a base URL and a relative URL
 *
 * @param {string} baseURL
 * @param {string} relativeURL
 *
 * @returns {string}
 *
 * @example
 * combineURLs("https://example.com/", "/api") => "https://example.com/api"
 * combineURLs("https://example.com", "api") => "https://example.com/api"
 */
export function combineURLs(baseURL: string, relativeURL: string): string {
  if (relativeURL) {
    /**
     * Remove trailing slashes from the baseURL
     *
     * @example
     * "https://example.com/" => "https://example.com"
     */
    const cleanedBaseURL = baseURL.replace(/\/+$/, "");

    /**
     * Remove leading slashes from the relativeURL
     *
     * @example
     * "/api" => "api"
     */
    const cleanedRelativeURL = relativeURL.replace(/^\/+/, "");

    /**
     * Join the cleanedBaseURL and cleanedRelativeURL
     *
     * @example
     * combineURLs("https://example.com/", "/api") => "https://example.com/api"
     */
    return [cleanedBaseURL, cleanedRelativeURL].join("/");
  }
  return baseURL;
}

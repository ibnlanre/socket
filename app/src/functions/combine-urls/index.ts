import { isAbsoluteURL } from "../is-absolute-url";
import { normalizeBaseURL } from "./normalize-base-url";
import { normalizeRelativeURL } from "./normalize-relative-url";

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
export function combineURLs(...urls: string[]): string {
  const { baseURL, relativeURLs } = urls.reduce(
    (acc, url) => {
      if (isAbsoluteURL(url)) acc.baseURL = url;
      else acc.relativeURLs.push(url);
      return acc;
    },
    { baseURL: "", relativeURLs: [] } as {
      baseURL: string;
      relativeURLs: string[];
    }
  );

  if (urls.length) {
    const normalizedBaseURL = normalizeBaseURL(baseURL);
    const normalizedRelativeURL = relativeURLs.map(normalizeRelativeURL);

    return [normalizedBaseURL]
      .concat(normalizedRelativeURL)
      .filter(Boolean)
      .join("/");
  }

  return baseURL;
}

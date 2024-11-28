/**
 * A URL is deemed absolute if it starts with "<scheme>://" or "//" (protocol-relative URL). According to RFC 3986, a scheme name starts with a letter and can be followed by letters, digits, plus signs, periods, or hyphens.
 *
 * @param {string} url
 * @returns {boolean}
 *
 * @example
 * isAbsoluteURL("https://example.com") => true
 * isAbsoluteURL("ftp://example.com") => true
 *
 * isAbsoluteURL("//example.com") => false
 * isAbsoluteURL("example.com") => false
 * isAbsoluteURL("example") => false
 */
export function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

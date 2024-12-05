export function extractPathname(url: string): string {
  try {
    const { pathname, search, hash } = new URL(url);
    return [pathname, search, hash].join("");
  } catch {
    return url.split("/").slice(3).join("/");
  }
}

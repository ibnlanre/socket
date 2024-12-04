export function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch (error) {
    return url.split("/").slice(3).join("/");
  }
}

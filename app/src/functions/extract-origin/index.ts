export function extractOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch (error) {
    return url.split("/").slice(0, 3).join("/");
  }
}

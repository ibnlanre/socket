/** Whether a stored response's `Expires` has passed. One without has. */
export function isExpired(response: Response, now = Date.now()): boolean {
  const expires = new Date(response.headers.get("Expires") || 0).getTime();
  return Number.isNaN(expires) || expires < now;
}

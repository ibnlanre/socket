import type { SocketParams } from "../types/socket-params";

export function paramsSerializer(params: SocketParams): string {
  const searchParams = new URLSearchParams();

  for (const key in params) {
    const value = params[key];

    if (value === undefined) continue;
    if (value === null) continue;

    if (typeof value === "string") {
      if (value.trim() === "") continue;
    }

    const item = encodeURIComponent(value);
    searchParams.append(key, item);
  }

  return searchParams.toString();
}

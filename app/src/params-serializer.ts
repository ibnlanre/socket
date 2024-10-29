import type { SocketParams } from "./types/SocketParams";

export function paramsSerializer(params: SocketParams): string {
  const searchParams = new URLSearchParams();

  for (const key in params) {
    const item = encodeURIComponent(params[key] ?? "");
    if (item !== "") searchParams.append(key, item);
  }

  return searchParams.toString();
}

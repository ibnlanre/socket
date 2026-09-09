import { combineURLs } from "@/functions/combine-urls";
import { paramsSerializer } from "@/functions/params-serializer";

import type { SocketURI } from "@/types/socket/uri";

export function getUri({ url, baseURL = "", params }: SocketURI): string {
  const fullPath = combineURLs(baseURL, url);
  if (!params) return fullPath;

  const serializedParams = paramsSerializer(params);
  const pathname = new URL(fullPath);

  for (const key of Object.keys(params)) pathname.searchParams.delete(key);
  new URLSearchParams(serializedParams).forEach((value, key) => {
    return pathname.searchParams.append(key, value);
  });

  pathname.searchParams.sort();
  return pathname.href;
}

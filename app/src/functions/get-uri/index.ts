import { combineURLs } from "@/functions/combine-urls";
import { paramsSerializer } from "@/functions/params-serializer";

import type { SocketURI } from "@/types/socket-uri";

export function getUri({ url, baseURL = "", params }: SocketURI): string {
  const fullPath = combineURLs(baseURL, url);
  if (!params) return fullPath;

  const serializedParams = paramsSerializer(params);
  const pathname = new URL(fullPath);
  pathname.search = serializedParams;

  return pathname.href;
}

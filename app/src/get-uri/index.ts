import type { SocketURI } from "@/types/socket-uri";

import { combineURLs } from "../combine-urls";
import { paramsSerializer } from "../params-serializer";

export function getUri({ url, baseURL = "", params }: SocketURI): string {
  const fullPath = combineURLs(baseURL, url);
  if (!params) return fullPath;

  const serializedParams = paramsSerializer(params);
  const pathname = new URL(fullPath);
  pathname.search = serializedParams;

  return pathname.href;
}

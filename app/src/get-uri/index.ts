import type { SocketURI } from "@/types/socket-uri";

import { combineURLs } from "@/combine-urls";
import { isAbsoluteURL } from "@/is-absolute-url";
import { paramsSerializer } from "@/params-serializer";

export function getUri({ url, baseURL = "", params }: SocketURI): string {
  const base = isAbsoluteURL(url) ? "" : baseURL;
  const fullPath = combineURLs(base, url);
  if (!params) return fullPath;

  const serializedParams = paramsSerializer(params);
  const pathname = new URL(fullPath);
  pathname.search = serializedParams;

  return pathname.href;
}

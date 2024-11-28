import { isEmpty } from "./is-empty";
import { isNull } from "./is-null";
import { isUndefined } from "./is-undefined";

import type { Ignore } from "@/types/ignore";
import type { SocketParams } from "@/types/socket-params";
import type { SocketPrimitives } from "@/types/socket-primitives";

/**
 * Serializes the parameters object into a query string
 *
 * @param {SocketParams} params The parameters object to serialize
 * @param {Ignore[]} ignore An array of values to filter from the query string
 * @returns The serialized query string
 */
export function paramsSerializer(
  params: SocketParams,
  ignore: Ignore[] = ["empty", "null", "undefined"]
): string {
  const searchParams = new URLSearchParams();

  function createSetQueryParam(key: string) {
    return (value: SocketPrimitives) => {
      if (isUndefined(value, ignore)) return;
      if (isNull(value, ignore)) return;
      if (isEmpty(value, ignore)) return;

      const item = encodeURIComponent(value);
      searchParams.append(key, item);
    };
  }

  for (const key in params) {
    const value = params[key];
    const setQueryParam = createSetQueryParam(key);

    if (Array.isArray(value)) value.forEach(setQueryParam);
    else setQueryParam(value);
  }

  return searchParams.toString();
}

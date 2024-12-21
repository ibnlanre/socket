import { isEmpty } from "./is-empty";
import { isNull } from "./is-null";
import { isUndefined } from "./is-undefined";

import type { ConnectionParams } from "@/types/connection-params";
import type { ExcludedValues } from "@/types/excluded-values";
import type { PrimitiveType } from "@/types/primitive-type";

/**
 * Serializes the parameters object into a query string
 *
 * @param {ConnectionParams} params The parameters object to serialize
 * @param {ExcludedValues[]} exclude An array of values to filter from the query string
 * @returns The serialized query string
 */
export function paramsSerializer(
  params: ConnectionParams,
  exclude: ExcludedValues[] = ["empty", "null", "undefined"]
): string {
  const searchParams = new URLSearchParams();

  function createSetQueryParam(key: string) {
    return (value: PrimitiveType) => {
      if (isUndefined(value, exclude)) return;
      if (isNull(value, exclude)) return;
      if (isEmpty(value, exclude)) return;

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

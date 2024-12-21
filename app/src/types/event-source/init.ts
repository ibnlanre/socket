import type { MethodInit } from "./method-init";

export interface Init extends RequestInit {
  /**
   * The `Headers` interface of the Fetch API allows you to perform various actions on HTTP request and response headers.
   * These actions include retrieving, setting, adding to, and removing headers from the list of the request's headers.
   * This interface is also used for other interfaces that need to represent headers, like the `Request` and `Response` interfaces.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
   * @see https://fetch.spec.whatwg.org/#concept-headers-list
   */
  headers?: HeadersInit;
  /**
   * The method to use for the Server-Sent Events connection
   *
   * @description The method is used to fetch the data from the server
   * @default "GET"
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Request/method)
   * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
   */
  method?: MethodInit;

  /**
   * The last event ID to use for the Server-Sent Events connection
   *
   * @description The last event ID is used to resume the connection from a specific event
   * @default null
   */
  initialLastEventId?: string | null;
}

import type { ReconnectionPolicy } from "./reconnection-policy";

type Header =
  | "A-IM"
  | "Accept"
  | "Accept-Charset"
  | "Accept-Encoding"
  | "Accept-Language"
  | "Accept-Patch"
  | "Accept-Ranges"
  | "Access-Control-Allow-Credentials"
  | "Access-Control-Allow-Headers"
  | "Access-Control-Allow-Methods"
  | "Access-Control-Allow-Origin"
  | "Access-Control-Expose-Headers"
  | "Access-Control-Max-Age"
  | "Age"
  | "Allow"
  | "Alt-Svc"
  | "Authorization"
  | "Cache-Control"
  | "Clear-Site-Data"
  | "Connection"
  | "Content-Disposition"
  | "Content-Encoding"
  | "Content-Language"
  | "Content-Length"
  | "Content-Location"
  | "Content-Range"
  | "Content-Security-Policy"
  | "Content-Security-Policy-Report-Only"
  | "Content-Type"
  | "Cookie"
  | "Cookie2"
  | "Cross-Origin-Embedder-Policy"
  | "Cross-Origin-Opener-Policy"
  | "Cross-Origin-Resource-Policy"
  | "DNT"
  | "Date"
  | "Device-Memory"
  | "Digest"
  | "ETag"
  | "Early-Data"
  | "Expect"
  | "Expect-CT"
  | "Expires"
  | "Feature-Policy"
  | "Forwarded"
  | "From"
  | "Host"
  | "If-Match"
  | "If-Modified-Since"
  | "If-None-Match"
  | "If-Range"
  | "If-Unmodified-Since"
  | "Index"
  | "Keep-Alive"
  | "Large-Allocation"
  | "Last-Event-ID"
  | "Last-Modified"
  | "Link"
  | "Location"
  | "NEL"
  | "Origin"
  | "Pragma"
  | "Proxy-Authenticate"
  | "Proxy-Authorization"
  | "Public-Key-Pins"
  | "Public-Key-Pins-Report-Only"
  | "Range"
  | "Referer"
  | "Referrer-Policy"
  | "Retry-After"
  | "Save-Data"
  | "Sec-Fetch-Dest"
  | "Sec-Fetch-Mode"
  | "Sec-Fetch-Site"
  | "Sec-Fetch-User"
  | "Sec-WebSocket-Accept"
  | "Sec-WebSocket-Extensions"
  | "Sec-WebSocket-Key"
  | "Sec-WebSocket-Protocol"
  | "Sec-WebSocket-Version"
  | "Server"
  | "Server-Timing"
  | "Set-Cookie"
  | "Set-Cookie2"
  | "SourceMap"
  | "Strict-Transport-Security"
  | "TE"
  | "Timing-Allow-Origin"
  | "Tk"
  | "Trailer"
  | "Transfer-Encoding"
  | "Upgrade"
  | "Upgrade-Insecure-Requests"
  | "User-Agent"
  | "Vary"
  | "Via"
  | "Viewport-Width"
  | "WWW-Authenticate"
  | "Warning"
  | "Width"
  | "X-Content-Type-Options"
  | "X-DNS-Prefetch-Control"
  | "X-Forwarded-For"
  | "X-Forwarded-Host"
  | "X-Forwarded-Proto"
  | "X-Frame-Options"
  | "X-XSS-Protection"
  | (string & {});

export type HeadersRecord = Record<Header, string>;
export type HeadersTuple = [Header, string][];
export type HeadersInit = HeadersTuple | HeadersRecord | Headers;

type MethodInit =
  | "CONNECT"
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT"
  | "TRACE";

interface Init extends RequestInit {
  /**
   * @see https://fetch.spec.whatwg.org/#concept-headers-list
   */
  headers?: HeadersInit;
  /**
   * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
   */
  method?: MethodInit;
}

type Base = {
  url: string;
  baseURL?: string;
};

export interface EventSourceClientOptions
  extends Base,
    Init,
    ReconnectionPolicy {
  url: string;
  initialLastEventId?: string;
}

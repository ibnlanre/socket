/** An opaque, client-owned result of asynchronous parameter validation. */
export interface PreparedParams<Params> {
  readonly params: Readonly<Params>;
  readonly key: string;
}

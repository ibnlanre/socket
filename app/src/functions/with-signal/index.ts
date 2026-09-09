/** Cancel one caller's wait without cancelling work shared by other callers. */
export function withSignal<Value>(
  promise: Promise<Value>,
  signal?: AbortSignal
): Promise<Value> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };

    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });

    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

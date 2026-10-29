/**
 * `WebSocket#readyState` values, fixed by the WebSocket specification.
 *
 * Read as literals rather than through the `WebSocket` constructor so that
 * state checks stay safe in runtimes where no `WebSocket` global exists —
 * notably when dispatching or tearing down a socket that was never opened.
 */
export const SocketReadyState = {
  CLOSED: 3,
  CLOSING: 2,
  CONNECTING: 0,
  OPEN: 1,
} as const;

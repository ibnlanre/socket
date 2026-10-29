/** What reconnecting needs of a client: the sockets that have stopped. */
export interface ExhaustedSource {
  exhausted: () => ReconnectableSocket[];
}

/** What reconnecting needs of a stopped socket: to open it, and watch it. */
export interface ReconnectableSocket {
  readonly isConnected: boolean;
  readonly isExhausted: boolean;
  readonly isIdle: boolean;
  observe: (listener: () => void) => () => void;
  open: () => void;
}

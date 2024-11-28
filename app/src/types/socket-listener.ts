export interface SocketListener {
  (event: "open", callback: (ev: Event) => void): void;
  (event: "close", callback: (ev: CloseEvent) => void): void;
  (event: "message", callback: (ev: MessageEvent) => void): void;
  (event: "error", callback: (ev: Event) => void): void;
}

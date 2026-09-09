export type SocketDiagnosticDetails =
  | {
      type: "connection";
      phase: "preparing" | "connecting" | "open" | "closed";
    }
  | { type: "retry"; attempt: number; delay: number }
  | {
      type: "queue";
      size: number;
      action: "queued" | "sent" | "expired" | "dropped" | "deduplicated";
    }
  | { type: "validation"; direction: "incoming" | "outgoing"; error: Error }
  | { type: "cache"; action: "hit" | "error"; error?: Error };

export type SocketDiagnostic = SocketDiagnosticDetails & { timestamp: number };

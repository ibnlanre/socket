export type SocketDiagnostic = SocketDiagnosticDetails & { timestamp: number };

export type SocketDiagnosticDetails =
  | {
      action: "deduplicated" | "dropped" | "expired" | "queued" | "sent";
      size: number;
      type: "queue";
    }
  | { action: "error" | "hit"; error?: Error; type: "cache"; }
  | { attempt: number; delay: number; type: "retry"; }
  | { direction: "incoming" | "outgoing"; error: Error; type: "validation"; }
  | {
      phase: "closed" | "connecting" | "open" | "preparing";
      type: "connection";
    };

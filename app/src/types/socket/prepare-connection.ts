export interface SocketConnectionPreparation {
  attempt: number;
  protocols: string | string[];
  signal: AbortSignal;
  url: string;
}

export type SocketPrepareConnection = (
  context: SocketConnectionPreparation
) =>
  | Promise<{ protocols?: string | string[]; url?: string; }>
  | { protocols?: string | string[]; url?: string; };

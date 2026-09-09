export interface SocketConnectionPreparation {
  url: string;
  protocols: string | string[];
  signal: AbortSignal;
  attempt: number;
}

export type SocketPrepareConnection = (
  context: SocketConnectionPreparation
) => { url?: string; protocols?: string | string[] } | Promise<{ url?: string; protocols?: string | string[] }>;

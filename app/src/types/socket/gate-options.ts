import type { UnitValue } from "@/types/time-unit";

export interface SocketGateOptions {
  /**
   * How many handshakes may be in flight at once, for each server (origin).
   *
   * @default 1
   */
  concurrency?: number;
  /**
   * Which queue a connection waits in, from its URL: by default its origin, so
   * different servers never wait on each other. Map several to one lane where
   * they sit behind one proxy, so their handshakes are paced together.
   *
   * @default the URL's origin
   */
  lane?: (url: string) => string;
  /**
   * How long one handshake may hold its turn. A handshake that has neither
   * opened nor failed by then lets the next one go, so a server that never
   * answers cannot hold the queue.
   *
   * @default "10 seconds"
   */
  timeout?: UnitValue;
}

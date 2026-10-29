import type { ExhaustedSource } from "./exhausted-source";

/**
 * What the hook needs of a client: its stopped sockets, and notice of changes.
 */
export interface ExhaustedClient extends ExhaustedSource {
  subscribe: (listener: () => void) => () => void;
}

import { extractOrigin } from "@/functions/extract-origin";
import { time } from "@/functions/time";
import type { SocketGateOptions } from "@/types/socket/gate-options";

type Waiting = {
  grant: (release: () => void) => void;
  signal?: AbortSignal;
  abort: () => void;
};
type Lane = { active: number; waiting: Waiting[] };

/**
 * Paces connection handshakes: no more than `concurrency` at once to any one
 * server, the rest queued in order. Some servers, and the proxies before them,
 * take connections one after another well but stall or drop several begun
 * together, as a page that opens all its feeds at once begins them. Give every
 * socket (or client) that talks to such a server the same gate.
 *
 * A turn lasts from just before the transport is created until the handshake
 * ends: the connection opens, or closes, or errors, or `timeout` passes.
 * Retries take their turn like any other attempt.
 */
export class SocketGate {
  readonly concurrency: number;
  #laneOf: (url: string) => string;
  #timeout: number;
  #lanes = new Map<string, Lane>();

  constructor({
    concurrency = 1,
    lane = extractOrigin,
    timeout = "10 seconds",
  }: SocketGateOptions = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError(
        "SocketGate: concurrency must be a positive integer."
      );
    }
    this.concurrency = concurrency;
    this.#laneOf = lane;
    this.#timeout = time(timeout);
  }

  #lane = (key: string): Lane => {
    let lane = this.#lanes.get(key);
    if (!lane) {
      lane = { active: 0, waiting: [] };
      this.#lanes.set(key, lane);
    }
    return lane;
  };

  /** Start a turn: it ends once, by `release()` or by the timeout. */
  #start = (key: string, lane: Lane): (() => void) => {
    lane.active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      lane.active -= 1;
      this.#next(key, lane);
    };
    const timer = setTimeout(release, this.#timeout);
    return release;
  };

  #next = (key: string, lane: Lane) => {
    while (lane.active < this.concurrency && lane.waiting.length) {
      const waiting = lane.waiting.shift()!;
      waiting.signal?.removeEventListener("abort", waiting.abort);
      waiting.grant(this.#start(key, lane));
    }
    if (!lane.active && !lane.waiting.length) this.#lanes.delete(key);
  };

  /**
   * Wait for a turn to connect to `url`, in its lane. Resolves with `release`,
   * which ends the turn and is safe to call more than once. An aborted wait
   * leaves the queue and rejects with the signal's reason.
   */
  acquire = (
    url: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<() => void> => {
    signal?.throwIfAborted();
    const origin = this.#laneOf(url);
    const lane = this.#lane(origin);
    if (lane.active < this.concurrency) {
      return Promise.resolve(this.#start(origin, lane));
    }
    return new Promise((resolve, reject) => {
      const waiting: Waiting = {
        abort: () => {
          const index = lane.waiting.indexOf(waiting);
          if (index >= 0) lane.waiting.splice(index, 1);
          this.#next(origin, lane);
          reject(signal?.reason);
        },
        grant: resolve,
        signal,
      };
      signal?.addEventListener("abort", waiting.abort, { once: true });
      lane.waiting.push(waiting);
    });
  };

  /** How many handshakes are in flight, and how many wait, in `url`'s lane. */
  load = (url: string): { active: number; waiting: number } => {
    const lane = this.#lanes.get(this.#laneOf(url));
    return { active: lane?.active ?? 0, waiting: lane?.waiting.length ?? 0 };
  };
}

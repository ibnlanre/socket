import { serializeJSON } from "@/functions/serialize-json";
import { time } from "@/functions/time";
import type { SocketDiagnostic } from "@/types/socket/diagnostic";
import type { SocketQueueOptions } from "@/types/socket/queue-options";

type Entry = {
  payload?: unknown;
  key?: string;
  ready: boolean;
  expiresAt: number;
  cancel: (error: Error) => void;
};

type Action = "queued" | "sent" | "expired" | "dropped" | "deduplicated";
type NotifyEvent = {
  type: "queue";
  size: number;
  action: Action;
};

/** Ordered, bounded waiting sends; independent of transport lifecycle. */
export class SocketOutbox {
  #entries: Entry[] = [];
  #history = new Map<string, number>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #maxSize: number;
  #maxAge: number;
  #maxHistory: number;
  #window: number;
  #overflow: "reject" | "drop-oldest";
  #dispatch: (payload: unknown) => boolean;
  #notify: (
    event: Omit<Extract<SocketDiagnostic, { type: "queue" }>, "timestamp">
  ) => void;

  constructor(
    options: SocketQueueOptions & { deduplicationWindow?: number },
    dispatch: (payload: unknown) => boolean,
    notify: (event: NotifyEvent) => void
  ) {
    this.#maxSize = options.maxQueueSize ?? 1000;
    this.#maxAge = time(options.queueMaxAge ?? "1 minute");
    this.#maxHistory = options.maxDeduplicationEntries ?? 1000;
    this.#window = options.deduplicationWindow ?? 0;
    this.#overflow = options.queueOverflow ?? "reject";
    this.#dispatch = dispatch;
    this.#notify = notify;

    if (!Number.isInteger(this.#maxSize) || this.#maxSize < 1) {
      throw new RangeError("maxQueueSize must be a positive integer.");
    }

    if (!Number.isInteger(this.#maxHistory) || this.#maxHistory < 1) {
      throw new RangeError(
        "maxDeduplicationEntries must be a positive integer."
      );
    }

    if (!Number.isFinite(this.#maxAge) || this.#maxAge <= 0) {
      throw new RangeError("queueMaxAge must be positive.");
    }
  }

  #emit = (action: Action) => {
    this.#notify({ type: "queue", size: this.#entries.length, action });
  };

  #remove = (entry: Entry, error: Error, action: "expired" | "dropped") => {
    const index = this.#entries.indexOf(entry);
    if (index < 0) return;
    this.#entries.splice(index, 1);
    entry.cancel(error);
    this.#emit(action);
  };

  #prune = () => {
    const now = Date.now();
    for (const entry of [...this.#entries]) {
      if (entry.expiresAt <= now)
        this.#remove(
          entry,
          new Error("Socket: queued send expired."),
          "expired"
        );
    }
    for (const [key, sentAt] of this.#history) {
      if (now - sentAt >= this.#window) this.#history.delete(key);
    }
  };

  #reserve = (cancel: Entry["cancel"]): Entry => {
    this.#prune();
    if (this.#entries.length >= this.#maxSize) {
      if (this.#overflow === "reject")
        throw new RangeError("Socket: send queue is full.");
      this.#remove(
        this.#entries[0],
        new Error("Socket: queued send dropped."),
        "dropped"
      );
    }
    const entry = {
      ready: false,
      expiresAt: Date.now() + this.#maxAge,
      cancel,
    };
    this.#entries.push(entry);
    this.#schedule();
    return entry;
  };

  #prepare = (entry: Entry, payload: unknown): boolean => {
    if (!this.#entries.includes(entry)) return false;
    const key = serializeJSON(payload);
    this.#prune();
    if (!this.#entries.includes(entry)) return false;
    const duplicate =
      this.#window > 0 &&
      (this.#history.has(key) ||
        this.#entries.some((other) => other !== entry && other.key === key));
    if (duplicate) {
      this.#entries.splice(this.#entries.indexOf(entry), 1);
      this.#emit("deduplicated");
      this.flush();
      return false;
    }
    // Snapshot the JSON value: mutation after send cannot change a queued frame.
    entry.payload = JSON.parse(key);
    entry.key = key;
    entry.ready = true;
    this.#emit("queued");
    this.flush();
    return true;
  };

  #schedule = () => {
    clearTimeout(this.#timer);
    if (!this.#entries.length && !this.#history.size) return;
    this.#timer = setTimeout(this.flush, 25);
  };

  send = (payload: unknown): boolean => {
    const entry = this.#reserve(() => {});
    try {
      return this.#prepare(entry, payload);
    } catch (error) {
      this.#remove(entry, error as Error, "dropped");
      throw error;
    }
  };

  sendAsync = (
    validate: () => Promise<unknown>,
    signal?: AbortSignal
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      let cleanup = () => {};
      const entry = this.#reserve((error) => {
        cleanup();
        reject(error);
      });
      const abort = () => {
        this.#remove(
          entry,
          signal?.reason ?? new DOMException("Aborted", "AbortError"),
          "dropped"
        );
        this.flush();
      };
      cleanup = () => signal?.removeEventListener("abort", abort);
      signal?.addEventListener("abort", abort, { once: true });
      Promise.resolve()
        .then(validate)
        .then((payload) => {
          if (!this.#entries.includes(entry)) return;
          resolve(this.#prepare(entry, payload));
        })
        .catch((error) => {
          this.#remove(entry, error, "dropped");
          reject(error);
          this.flush();
        })
        .finally(() => signal?.removeEventListener("abort", abort));
    });
  };

  flush = () => {
    this.#prune();

    // Re-read the queue head on every pass: entries are shifted as they are
    // dispatched, so a stale reference would otherwise loop forever.
    while (this.#entries.length > 0) {
      const entry = this.#entries[0];
      if (!entry.ready) break;
      try {
        if (!this.#dispatch(entry.payload)) break;
      } catch (error) {
        this.#remove(entry, error as Error, "dropped");
        continue;
      }

      this.#entries.shift();
      if (this.#window > 0) {
        this.#history.delete(entry.key!);
        this.#history.set(entry.key!, Date.now());

        while (this.#history.size > this.#maxHistory) {
          this.#history.delete(this.#history.keys().next().value!);
        }
      }
      this.#emit("sent");
    }
    this.#schedule();
  };

  clear = () => {
    for (const entry of [...this.#entries])
      this.#remove(
        entry,
        new DOMException("Socket closed", "AbortError"),
        "dropped"
      );
    this.#history.clear();
    clearTimeout(this.#timer);
  };
}

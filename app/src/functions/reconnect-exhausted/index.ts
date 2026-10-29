import type { ExhaustedSource, ReconnectableSocket } from "@/types/exhausted-source";
import type { ReconnectExhaustedOptions } from "@/types/reconnect-exhausted-options";

import { time } from "@/functions/time";

/**
 * Open the stopped sockets of every client given (each one's `exhausted()`),
 * one after another, `stagger` apart. Resolves once each has connected, or
 * stopped again, or been closed, with how many connected. A socket that fails
 * again stops again, and is offered again; one that cannot be opened (disposed
 * meanwhile) is passed over, and the rest still open.
 */
export async function reconnectExhausted(
  clients: readonly ExhaustedSource[],
  { stagger = 0 }: ReconnectExhaustedOptions = {}
): Promise<number> {
  const sockets = clients.flatMap((client) => client.exhausted());
  const delay = time(stagger);
  const outcomes: Promise<boolean>[] = [];

  for (const [index, socket] of sockets.entries()) {
    if (index > 0 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    // Opened by something else since, or gone from its pool: not this one's to open.
    if (!socket.isExhausted) continue;
    outcomes.push(reopen(socket));
  }

  const connected = await Promise.all(outcomes);
  return connected.filter(Boolean).length;
}

/**
 * Open a stopped socket and wait for how it ends: true once it connects,
 * false if it stops again or is closed (disposing closes it) first. Opening
 * moves it straight to "preparing", so "idle" afterwards is a close.
 */
function reopen(socket: ReconnectableSocket): Promise<boolean> {
  try {
    socket.open();
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const settle = () => {
      const outcome = socket.isConnected
        ? true
        : socket.isExhausted || socket.isIdle
          ? false
          : undefined;
      if (outcome === undefined) return;

      stop();
      resolve(outcome);
    };
    const stop = socket.observe(settle);
    settle();
  });
}

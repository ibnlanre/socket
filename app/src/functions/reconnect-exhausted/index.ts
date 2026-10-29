import { time } from "@/functions/time";
import type { ExhaustedSource } from "@/types/exhausted-source";
import type { ReconnectExhaustedOptions } from "@/types/reconnect-exhausted-options";

/**
 * Open the stopped sockets of every client given (each one's `exhausted()`),
 * one after another, `stagger` apart. Resolves with how many it reopened.
 * A socket that fails again stops again, and is offered again.
 */
export async function reconnectExhausted(
  clients: readonly ExhaustedSource[],
  { stagger = 0 }: ReconnectExhaustedOptions = {}
): Promise<number> {
  const sockets = clients.flatMap((client) => client.exhausted());
  const delay = time(stagger);
  for (const [index, socket] of sockets.entries()) {
    if (index > 0 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    socket.open();
  }
  return sockets.length;
}

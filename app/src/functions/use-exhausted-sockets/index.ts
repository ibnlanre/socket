import type { ExhaustedClient } from "@/types/exhausted-client";
import type { ReconnectExhaustedOptions } from "@/types/reconnect-exhausted-options";
import type { UseExhaustedSocketsResult } from "@/types/use-exhausted-sockets-result";

import { useCallback, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

import { reconnectExhausted } from "@/functions/reconnect-exhausted";

/**
 * Watch several clients' sockets for those that have stopped after failures
 * they will not retry, and reopen them on request: for one app-wide notice
 * ("live updates have stopped. Reconnect") rather than each screen its own.
 * Watching keeps nothing open; the count is 0 on the server.
 */
export function useExhaustedSockets(
  clients: readonly ExhaustedClient[],
  { stagger }: ReconnectExhaustedOptions = {}
): UseExhaustedSocketsResult {
  const watched = useStableClients(clients);
  const subscribe = useCallback(
    (notify: () => void) => {
      const stops = watched.map((client) => client.observe(notify));
      return () => stops.forEach((stop) => stop());
    },
    [watched]
  );
  const count = useSyncExternalStore(
    subscribe,
    () => {
      return watched.reduce((total, client) => {
        return total + client.exhausted().length;
      }, 0);
    },
    () => 0
  );
  const [isReconnecting, setReconnecting] = useState(false);
  const reconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      return await reconnectExhausted(watched, { stagger });
    } finally {
      setReconnecting(false);
    }
  }, [watched, stagger]);

  return { count, isReconnecting, reconnect };
}

/**
 * The same clients as last render, if they are the same: callers often pass a
 * fresh array. Kept in state, adjusted while rendering, so a render React
 * throws away leaves nothing behind.
 */
function useStableClients(
  clients: readonly ExhaustedClient[]
): readonly ExhaustedClient[] {
  const [stable, setStable] = useState(clients);
  const same =
    stable.length === clients.length &&
    stable.every((client, index) => client === clients[index]);

  if (!same) setStable(clients);
  return same ? stable : clients;
}

import { reconnectExhausted } from "@/functions/reconnect-exhausted";
import type { ExhaustedClient } from "@/types/exhausted-client";
import type { ReconnectExhaustedOptions } from "@/types/reconnect-exhausted-options";
import type { UseExhaustedSocketsResult } from "@/types/use-exhausted-sockets-result";
import { useCallback, useRef, useState } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

/**
 * The same clients as last render, if they are the same: callers often pass a
 * fresh array.
 */
function useStableClients(
  clients: readonly ExhaustedClient[]
): readonly ExhaustedClient[] {
  const stable = useRef(clients);
  const same =
    stable.current.length === clients.length &&
    stable.current.every((client, index) => client === clients[index]);
  if (!same) stable.current = clients;
  return stable.current;
}

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
      const stops = watched.map((client) => client.subscribe(notify));
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

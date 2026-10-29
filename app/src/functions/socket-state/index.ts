import type { SocketState } from "@/types/socket/state";

/** State for a subscription that has not resolved a managed socket yet. */
export function socketState<Get>({
  binaryType = "blob",
  enabled,
  error = null,
  initialData,
  placeholderData,
}: {
  binaryType?: BinaryType;
  enabled: boolean;
  error?: Error | null;
  initialData?: Get;
  placeholderData?: Get;
}): SocketState<Get> {
  return Object.freeze({
    binaryType,
    dataUpdatedAt: 0,
    error,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: enabled && !error ? "preparing" : "idle",
    isConnected: false,
    isConnecting: false,
    isDisconnected: false,
    isError: error !== null,
    isExhausted: false,
    isIdle: !enabled,
    isLoading: enabled && !error,
    // Placeholder data is still pending, as a socket reports it.
    isPending: initialData === undefined,
    isPlaceholderData:
      initialData === undefined && placeholderData !== undefined,
    isPreparing: enabled && !error,
    isRefetchError: false,
    isRefetching: false,
    isStaleData: false,
    isSuccess: false,
    status: error ? "error" : enabled ? "loading" : "idle",
    value: initialData ?? placeholderData,
  });
}

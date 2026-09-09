import type { SocketState } from "@/types/socket/state";

/** State for a subscription that has not resolved a managed socket yet. */
export function socketState<Get>(
  enabled: boolean,
  value?: Get,
  error: Error | null = null,
  binaryType: BinaryType = "blob"
): SocketState<Get> {
  return Object.freeze({
    binaryType,
    dataUpdatedAt: 0,
    error,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    fetchStatus: enabled && !error ? "preparing" : "idle",
    status: error ? "error" : enabled ? "loading" : "idle",
    isPreparing: enabled && !error,
    isConnected: false,
    isConnecting: false,
    isDisconnected: false,
    isError: error !== null,
    isIdle: !enabled,
    isLoading: enabled && !error,
    isPending: value === undefined,
    isPlaceholderData: value !== undefined,
    isRefetchError: false,
    isRefetching: false,
    isStaleData: false,
    isSuccess: false,
    value,
  });
}

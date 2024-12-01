import { SocketCloseCode } from "@/constants/socket-close-code";

export type SocketReconnectOptions = {
  /**
   * Whether to retry the WebSocket connection or not
   *
   * @default false
   */
  retry?: boolean;

  /**
   * The delay in milliseconds before retrying the WebSocket connection
   *
   * @default 1000 (1 second)
   */
  retryDelay?: number;

  /**
   * The number of times to retry the WebSocket connection
   *
   * @description If set to `0`, the connection will not be retried
   * @description If set to `Infinity`, the connection will be retried indefinitely
   *
   * @default 3
   */
  retryCount?: number;

  /**
   * Whether to retry the connection when the network is restored
   *
   * @default true
   * @description If set to true, the connection will be retried when the network is restored even if the retry count has been reached   */
  reconnectOnNetworkRestore?: boolean;

  /**
   * Whether to retry the connection when the window regains focus
   *
   * @default true
   */
  reconnectOnWindowFocus?: boolean;

  /**
   * The strategy for increasing the delay between retries (e.g., fixed, exponential)
   *
   * @default 'fixed'
   */
  retryBackoffStrategy?: "fixed" | "exponential";

  /**
   * The maximum delay in milliseconds between retries
   *
   * @default 60000 (1 minute)
   */
  maxRetryDelay?: number;

  /**
   * An array of specific close codes that should trigger a retry
   *
   * @default
   * [
   *   SocketCloseCode.ABNORMAL_CLOSURE,
   *   SocketCloseCode.TRY_AGAIN_LATER,
   *   SocketCloseCode.SERVICE_RESTART
   * ]
   */
  retryOnSpecificCloseCodes?: SocketCloseCode[];

  /**
   * A custom function to determine whether to retry based on the error or response
   *
   * @default undefined
   */
  retryOnCustomCondition?: (event: CloseEvent, socket: WebSocket) => boolean;

  /**
   * The minimum value for the jitter
   *
   * @default 0.8
   */
  minJitterValue?: number;

  /**
   * The maximum value for the jitter
   *
   * @default 1.2
   */
  maxJitterValue?: number;
};

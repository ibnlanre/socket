import { SocketCloseCode } from "@/constants/SocketCloseCode";

export type SocketRetrial = {
  /**
   * Whether to retry the WebSocket connection or not
   *
   * @default true
   */
  retry?: boolean;

  /**
   * The delay in milliseconds before retrying the WebSocket connection
   *
   * @default 1000
   */
  retryDelay?: number;

  /**
   * The number of times to retry the WebSocket connection
   *
   * @default 0
   * @description If set to 0, the connection will not be retried
   * @description If set to -1, the connection will be retried indefinitely
   */
  retryCount?: number;

  /**
   * Whether to retry the connection when the network is restored
   *
   * @default true
   * @description If set to true, the connection will be retried when the network is restored even if the retry count has been reached   */
  retryOnNetworkRestore?: boolean;

  /**
   * The strategy for increasing the delay between retries (e.g., fixed, exponential)
   *
   * @default 'fixed'
   */
  retryBackoffStrategy?: "fixed" | "exponential";

  /**
   * The maximum delay in milliseconds between retries
   *
   * @default 30000
   */
  maxRetryDelay?: number;

  /**
   * An array of specific close codes that should trigger a retry
   *
   * @default [SocketCloseCode.ABNORMAL_CLOSURE]
   */
  retryOnSpecificCloseCodes?: SocketCloseCode[];

  /**
   * A custom function to determine whether to retry based on the error or response
   *
   * @default undefined
   */
  retryOnCustomCondition?: (error: any, response?: Response) => boolean;
};

import type { UnitValue } from "./time-unit";

export type ReconnectionPolicy = {
  /**
   * Whether to retry the WebSocket connection or not
   *
   * @default false
   */
  retry?: boolean;

  /**
   * The delay in milliseconds before retrying the WebSocket connection
   *
   * @default "5 seconds"
   */
  retryDelay?: UnitValue;

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
   * The strategy for increasing the delay between retries (e.g., fixed, exponential)
   *
   * @default 'fixed'
   */
  retryBackoffStrategy?: "fixed" | "exponential";

  /**
   * The maximum delay in milliseconds between retries
   *
   * @default "1 minute"
   */
  maxRetryDelay?: UnitValue;

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

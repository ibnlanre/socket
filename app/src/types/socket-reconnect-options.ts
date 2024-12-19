import type { SocketCode } from "@/constants/socket-close-code";
import type { ReconnectionPolicy } from "./reconnection-policy";
import type { UnitValue } from "./socket-time-unit";

export interface SocketReconnectOptions extends ReconnectionPolicy {
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
   * An array of specific close codes that should trigger a retry
   *
   * @default
   * [
   *   SocketCloseCode.ABNORMAL_CLOSURE,
   *   SocketCloseCode.TRY_AGAIN_LATER,
   *   SocketCloseCode.SERVICE_RESTART
   * ]
   */
  retryOnSpecificCloseCodes?: SocketCode[];

  /**
   * A custom function to determine whether to retry based on the error or response
   *
   * @default undefined
   */
  retryOnCustomCondition?: (event: CloseEvent, socket: WebSocket) => boolean;

  /**
   * The time to wait before closing an idle connection.
   *
   * @default "5 minutes"
   */
  idleConnectionTimeout?: UnitValue;
}

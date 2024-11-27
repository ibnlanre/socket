import { SocketCloseCode } from "./constants/socket-close-code";
import type { SocketConstructor } from "./types/socket-constructor";
import type { SocketEvent } from "./types/socket-event";

export class SocketBase {
  protected log: SocketEvent[];
  protected baseURL: string;
  protected retry: boolean;
  protected retryDelay: number;
  protected minJitterValue: number;
  protected maxJitterValue: number;
  protected retryCount: number;
  protected retryOnNetworkRestore: boolean;
  protected retryBackoffStrategy: "fixed" | "exponential";
  protected maxRetryDelay: number;
  protected retryOnSpecificCloseCodes: SocketCloseCode[];
  protected currentRetryAttempt = 0;
  protected networkRestoreListener: (() => void) | null = null;
  protected retryOnCustomCondition?: (
    event: CloseEvent,
    target: WebSocket
  ) => boolean;
  protected url: string;

  constructor({
    log = ["open", "close", "error"],
    baseURL = "",
    retry = false,
    retryDelay = 1000,
    retryCount = 3,
    minJitterValue = 0.8,
    maxJitterValue = 1.2,
    retryOnNetworkRestore = true,
    retryBackoffStrategy = "exponential",
    maxRetryDelay = 30000,
    retryOnSpecificCloseCodes = [
      SocketCloseCode.ABNORMAL_CLOSURE,
      SocketCloseCode.TRY_AGAIN_LATER,
      SocketCloseCode.SERVICE_RESTART,
    ],
    retryOnCustomCondition,
    url,
  }: SocketConstructor) {
    this.log = log;
    this.baseURL = baseURL;
    this.retry = retry;
    this.retryDelay = retryDelay;
    this.retryCount = retryCount;
    this.minJitterValue = minJitterValue;
    this.maxJitterValue = maxJitterValue;
    this.retryOnNetworkRestore = retryOnNetworkRestore;
    this.retryBackoffStrategy = retryBackoffStrategy;
    this.maxRetryDelay = maxRetryDelay;
    this.retryOnSpecificCloseCodes = retryOnSpecificCloseCodes;
    this.retryOnCustomCondition = retryOnCustomCondition;
    this.url = url;
  }
}

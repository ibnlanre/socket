import type { UnitValue } from "../time-unit";

export interface SocketQueueOptions {
  /** Maximum pending incoming validations before the connection is closed. @default 1000 */
  maxPendingMessages?: number;
  /** Maximum waiting sends, including async validation. @default 1000 */
  maxQueueSize?: number;
  /** Maximum age of a waiting send. @default "1 minute" */
  queueMaxAge?: UnitValue;
  /** What to do when the queue is full. @default "reject" */
  queueOverflow?: "reject" | "drop-oldest";
  /** Maximum bytes buffered by the browser before waiting. @default 1048576 */
  maxBufferedAmount?: number;
  /** Maximum retained deduplication keys. @default 1000 */
  maxDeduplicationEntries?: number;
}

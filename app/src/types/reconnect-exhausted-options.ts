import type { UnitValue } from "./time-unit";

export interface ReconnectExhaustedOptions {
  /**
   * The pause between one socket's reopening and the next's.
   *
   * @default 0
   */
  stagger?: UnitValue;
}

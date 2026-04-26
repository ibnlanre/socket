import type { ZodType } from "zod";

export type SocketSchema<T = unknown> = ZodType<T>;

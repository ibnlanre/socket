import type { ZodType, output } from "zod";

export type InferSocketSchema<Schema extends ZodType> = output<Schema>;

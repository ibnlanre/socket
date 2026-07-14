import type { StandardSchemaV1 } from "@standard-schema/spec";

export type InferSocketSchema<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>;

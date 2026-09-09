import type { StandardSchemaV1 } from "@standard-schema/spec";

export type SocketSchema<Input = unknown, Output = Input> = StandardSchemaV1<
  Input,
  Output
>;

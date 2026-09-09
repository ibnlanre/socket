import type { StandardSchemaV1 } from "@standard-schema/spec";

export function schemaValue<Value>(
  result: StandardSchemaV1.Result<Value>,
  message: string
): Value {
  if (result.issues) {
    const detail = result.issues.map((issue) => issue.message).join("; ");
    throw new Error(detail ? `${message}: ${detail}` : message, {
      cause: result.issues,
    });
  }
  return result.value;
}

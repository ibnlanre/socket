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

export function validateSchema<Input, Output>(
  schema: StandardSchemaV1<Input, Output>,
  input: Input,
  message: string
): Output {
  const result = schema["~standard"].validate(input);
  if ("then" in result) {
    // A synchronous caller cannot consume the result, but must handle rejection.
    void Promise.resolve(result).catch(() => {});
    throw new TypeError(`${message}: async schemas require the async API.`);
  }
  return schemaValue(result, message);
}

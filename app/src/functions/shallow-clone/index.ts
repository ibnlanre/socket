export function shallowClone<Value>(value: Value): Value {
  return Object.create(
    Object.getPrototypeOf(value),
    Object.getOwnPropertyDescriptors(value)
  );
}

export function shallowMerge<Target extends object, Source>(
  target: Target,
  source: Source
) {
  return Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors(source)
  ) as Target & Source;
}

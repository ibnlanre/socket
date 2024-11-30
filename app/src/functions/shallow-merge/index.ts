export function shallowMerge<Target extends {}, Source>(
  target: Target,
  source: Source
) {
  return Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors(source)
  ) as Target & Source;
}

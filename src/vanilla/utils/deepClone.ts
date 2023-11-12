const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

export const deepClone = <T>(obj: T, getRefSet?: () => WeakSet<object>): T => {
  if (!isObject(obj) || getRefSet?.().has(obj)) {
    return obj
  }
  const baseObject: T = Array.isArray(obj)
    ? []
    : Object.create(Object.getPrototypeOf(obj))
  Reflect.ownKeys(obj).forEach((key) => {
    baseObject[key as keyof T] = deepClone(obj[key as keyof T], getRefSet)
  })
  return baseObject
}

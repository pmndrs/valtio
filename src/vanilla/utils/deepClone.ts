import { unstable_isRef } from '../../vanilla.js'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

/**
 * Creates a deep clone of an object, maintaining proxy behavior for Maps and Sets
 */
export function deepClone<T>(obj: T): T {
  if (!isObject(obj) || unstable_isRef(obj)) {
    return obj
  }

  const baseObject: T = Array.isArray(obj)
    ? []
    : Object.create(Object.getPrototypeOf(obj))
  Reflect.ownKeys(obj).forEach((key) => {
    baseObject[key as keyof T] = deepClone(obj[key as keyof T])
  })
  return baseObject
}

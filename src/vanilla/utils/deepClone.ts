import { unstable_isRef } from '../../vanilla.js'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

/**
 * Creates a deep clone of an object, maintaining proxy behavior for Maps and Sets
 *
 * Objects for which `isRef` returns true are kept by reference. By default,
 * those are the objects marked with `ref`.
 */
export function deepClone<T>(
  obj: T,
  isRef: (x: object) => boolean = unstable_isRef,
): T {
  if (!isObject(obj) || isRef(obj)) {
    return obj
  }

  const baseObject: T = Array.isArray(obj)
    ? []
    : Object.create(Object.getPrototypeOf(obj))
  Reflect.ownKeys(obj).forEach((key) => {
    baseObject[key as keyof T] = deepClone(obj[key as keyof T], isRef)
  })
  return baseObject
}

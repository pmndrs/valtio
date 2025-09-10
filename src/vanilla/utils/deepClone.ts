import {
  unstable_getInternalStates,
  valtioDebugProxyUID,
} from '../../vanilla.ts'
import { isProxyMap, proxyMap } from './proxyMap.ts'
import { isProxySet, proxySet } from './proxySet.ts'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

let defaultRefSet: WeakSet<object> | undefined
const getDefaultRefSet = (): WeakSet<object> => {
  if (!defaultRefSet) {
    defaultRefSet = unstable_getInternalStates().refSet
  }
  return defaultRefSet
}

/**
 * Creates a deep clone of an object, maintaining proxy behavior for Maps and Sets
 *
 * @template T - Type of the object to clone
 * @param {T} obj - The object to clone
 * @param {Function} [getRefSet=getDefaultRefSet] - Function to get the set of reference objects
 * @returns {T} A deep clone of the input object
 */
export function deepClone<T>(
  obj: T,
  getRefSet: () => WeakSet<object> = getDefaultRefSet,
): T {
  if (!isObject(obj) || getRefSet().has(obj)) {
    return obj
  }

  if (isProxySet(obj)) {
    return proxySet([...(obj as unknown as Iterable<unknown>)]) as unknown as T
  }

  if (isProxyMap(obj)) {
    return proxyMap([
      ...(obj as unknown as Map<unknown, unknown>).entries(),
    ]) as unknown as T
  }

  const baseObject: T = Array.isArray(obj)
    ? []
    : Object.create(Object.getPrototypeOf(obj))
  Reflect.ownKeys(obj).forEach((key) => {
    if (key === valtioDebugProxyUID) {
      return
    }
    baseObject[key as keyof T] = deepClone(obj[key as keyof T], getRefSet)
  })
  return baseObject
}

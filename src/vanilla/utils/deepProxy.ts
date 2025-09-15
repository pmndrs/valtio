import { proxy, unstable_getInternalStates } from '../../vanilla.ts'
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
 * Deeply proxies an input while normalizing Maps/Sets into proxyMap/proxySet.
 * - Values in refSet or primitives are returned as-is.
 * - Map/proxyMap and Set/proxySet are re-instantiated by passing their existing iterables directly.
 * - Arrays/objects are rebuilt recursively and wrapped with proxy().
 */
export function deepProxy<T>(
  obj: T,
  getRefSet: () => WeakSet<object> = getDefaultRefSet,
): T {
  if (!isObject(obj) || getRefSet().has(obj)) {
    return obj
  }

  if (obj instanceof Set || isProxySet(obj as object)) {
    return proxySet(obj as unknown as Iterable<unknown>) as T
  }

  if (obj instanceof Map || isProxyMap(obj as object)) {
    return proxyMap(obj as unknown as Iterable<[unknown, unknown]>) as T
  }

  const baseObject: T = Array.isArray(obj)
    ? ([] as unknown as T)
    : Object.create(Object.getPrototypeOf(obj))

  Reflect.ownKeys(obj).forEach((key) => {
    baseObject[key as keyof T] = deepProxy(
      (obj as Record<PropertyKey, unknown>)[key] as T[keyof T],
      getRefSet,
    )
  })

  return proxy(baseObject as unknown as object) as T
}

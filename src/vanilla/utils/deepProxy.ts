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

const cloneContainer = <T extends object>(src: T): T => {
  return (
    Array.isArray(src) ? [] : Object.create(Object.getPrototypeOf(src))
  ) as T
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
  const visit = (value: unknown) => {
    if (!isObject(value) || getRefSet().has(value)) return value

    if (value instanceof Set || isProxySet(value as object)) {
      return proxySet(value as Iterable<unknown>)
    }

    if (value instanceof Map || isProxyMap(value as object)) {
      return proxyMap(value as Iterable<[unknown, unknown]>)
    }

    const memo = new WeakMap<object, unknown>()
    const hit = memo.get(value)

    if (hit) return hit

    const target = cloneContainer(value)
    memo.set(value, target)

    for (const key of Reflect.ownKeys(value)) {
      const desc = Reflect.getOwnPropertyDescriptor(value, key)
      if (!desc) continue // type guard to make sure we can access metadata
      if ('value' in desc) {
        const next = visit((value as Record<PropertyKey, unknown>)[key])
        Object.defineProperty(target, key, { ...desc, value: next })
      } else {
        Object.defineProperty(target, key, desc)
      }
    }

    return proxy(target)
  }

  return visit(obj) as T
}

import { proxy, unstable_getInternalStates } from '../../vanilla.js'
import { registerSnapshotInitializer } from './snapshot.js'

const { proxyStateMap } = unstable_getInternalStates()
const SNAPSHOT_INDEX = Symbol()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type RSetLike<T> = { has(value: T): boolean }

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: () => object
  index: number
  epoch: { value: number }
  intersection<U>(other: RSetLike<U>): Set<T & U>
  intersection(other: Set<T>): Set<T>
  union<U>(other: RSetLike<U>): Set<T | U>
  union(other: Set<T>): Set<T>
  difference<U>(other: RSetLike<U>): Set<T>
  difference(other: Set<T>): Set<T>
  symmetricDifference<U>(other: RSetLike<U>): Set<T | U>
  symmetricDifference(other: Set<T>): Set<T>
  isSubsetOf(other: RSetLike<T>): boolean
  isSupersetOf(other: RSetLike<T>): boolean
  isDisjointFrom(other: RSetLike<T>): boolean
}

/**
 * Determines if an object is a proxy Set created with proxySet
 */
export const isProxySet = (obj: object): boolean => {
  return (
    Symbol.toStringTag in obj &&
    obj[Symbol.toStringTag] === 'Set' &&
    proxyStateMap.has(obj)
  )
}

/**
 * Creates a reactive Set that integrates with Valtio's proxy system
 *
 * This utility creates a Set-like object that works with Valtio's reactivity system,
 * allowing you to track changes to the Set in the same way as regular proxy objects.
 * The API extends the standard JavaScript Set with additional set operations like
 * union, intersection, difference, etc.
 *
 * @example
 * import { proxySet } from 'valtio/utils'
 * const state = proxySet([1,2,3])
 *
 * // can be used inside a proxy as well
 * const state = proxy({
 *   count: 1,
 *   set: proxySet()
 * })
 */

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const initialData: T[] = []
  const indexMap = new Map<T, number>()
  let initialIndex = 0

  const getMapForThis = (x: any) => {
    if (isProxy(x)) {
      return indexMap
    }
    x.epoch.value
    return (x[SNAPSHOT_INDEX] as Map<T, number> | undefined) || indexMap
  }

  if (initialValues) {
    if (typeof initialValues[Symbol.iterator] !== 'function') {
      throw new TypeError('not iterable')
    }
    for (const value of initialValues) {
      if (!indexMap.has(value)) {
        const v = maybeProxify(value)
        indexMap.set(v, initialIndex)
        initialData[initialIndex++] = v
      }
    }
  }

  const isIterable = (o: unknown): o is Iterable<unknown> =>
    typeof o === 'object' && o !== null && Symbol.iterator in (o as object)

  const hasForEach = <U>(
    o: RSetLike<U>,
  ): o is RSetLike<U> & { forEach: (cb: (v: U) => void) => void } =>
    typeof (o as { forEach?: unknown }).forEach === 'function'

  const asIterable = <U>(other: RSetLike<U> | Set<U>): Iterable<U> => {
    if (isIterable(other)) return other as Iterable<U>
    if (hasForEach(other)) {
      const acc: U[] = []
      other.forEach((v) => acc.push(v))
      return acc
    }
    throw new TypeError('Expected an iterable')
  }

  function intersectionImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T & U>
  function intersectionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function intersectionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<T>()
    for (const value of this.values()) {
      if (otherSet.has(value)) {
        result.add(value)
      }
    }
    return proxySet(result)
  }

  function unionImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T | U>
  function unionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function unionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<unknown>()
    for (const v of this.values()) result.add(v)
    for (const v of otherSet.values()) result.add(v)
    return proxySet(result)
  }

  function differenceImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T>
  function differenceImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function differenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<T> {
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<T>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    return proxySet(result)
  }

  function symmetricDifferenceImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T | U>
  function symmetricDifferenceImpl<T>(
    this: InternalProxySet<T>,
    other: Set<T>,
  ): Set<T>
  function symmetricDifferenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<unknown>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    // (v as T) -> v is unknown from RSetLike<unknown>, but has() accepts T and safely handles type mismatches
    for (const v of otherSet.values()) if (!this.has(v as T)) result.add(v)
    return proxySet(result)
  }

  const vObject: InternalProxySet<T> = {
    data: initialData,
    index: initialIndex,
    epoch: { value: 0 },
    get size() {
      return getMapForThis(this).size
    },
    has(value: T) {
      const map = getMapForThis(this)
      const v = maybeProxify(value)
      return map.has(v)
    },
    add(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
        indexMap.set(v, this.index)
        this.data[this.index++] = v
        this.epoch.value++
      }
      return this
    },
    delete(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      const index = indexMap.get(v)
      if (index === undefined) {
        return false
      }
      delete this.data[index]
      indexMap.delete(v)
      this.epoch.value++
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0 // empty array
      this.index = 0
      this.epoch.value++
      indexMap.clear()
    },
    forEach(cb: (value: T, valueAgain: T, set: Set<T>) => void) {
      const map = getMapForThis(this)
      map.forEach((index) => {
        cb(this.data[index]!, this.data[index]!, this)
      })
    },
    *values(): ReturnType<Set<T>['values']> {
      const map = getMapForThis(this)
      for (const index of map.values()) {
        yield this.data[index]!
      }
    },
    keys(): ReturnType<Set<T>['keys']> {
      return this.values()
    },
    *entries(): ReturnType<Set<T>['entries']> {
      const map = getMapForThis(this)
      for (const index of map.values()) {
        const value = this.data[index]!
        yield [value, value]
      }
    },
    toJSON(): Set<T> {
      return new Set(this.values())
    },
    [Symbol.iterator]() {
      return this.values()
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    intersection: intersectionImpl,
    union: unionImpl,
    difference: differenceImpl,
    symmetricDifference: symmetricDifferenceImpl,
    isSubsetOf(other: RSetLike<T>) {
      for (const v of this.values()) if (!other.has(v)) return false
      return true
    },
    isSupersetOf(other: RSetLike<T>) {
      const it = asIterable(other)
      for (const v of it) if (!this.has(v)) return false
      return true
    },
    isDisjointFrom(other: RSetLike<T>) {
      for (const v of this.values()) if (other.has(v)) return false
      return true
    },
  }

  registerSnapshotInitializer(vObject, (snapshotObject) => {
    if (!Reflect.has(snapshotObject, SNAPSHOT_INDEX)) {
      Object.defineProperty(snapshotObject, SNAPSHOT_INDEX, {
        value: new Map(indexMap),
      })
    }
  })
  const proxiedObject = proxy(vObject)
  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    index: { enumerable: false },
    epoch: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as InternalProxySet<T> & {
    $$valtioSnapshot: Omit<InternalProxySet<T>, 'set' | 'delete' | 'clear'>
  }
}

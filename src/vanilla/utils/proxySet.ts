import { isProxyObject as isProxy, proxy, ref } from '../../vanilla.js'
import { createIndex, getIndexKey } from './collectionIndex.js'

const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)

type RSetLike<T> = { has(value: T): boolean }

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: () => object
  index: number
  lookup: ReturnType<typeof createIndex<T>>
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
    isProxy(obj)
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

  const indexes = new WeakMap<object, Map<T, number>>()
  const getMapForThis = (x: any) => {
    if (isProxy(x)) return indexMap
    const entries = x.lookup.entries as { key: T }[]
    let map = indexes.get(entries)
    if (!map) {
      map = new Map()
      entries.forEach((entry, index) => map!.set(entry.key, index))
      indexes.set(entries, map)
    }
    return map
  }

  if (initialValues) {
    if (typeof initialValues[Symbol.iterator] !== 'function') {
      throw new TypeError('not iterable')
    }
    for (const value of initialValues) {
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
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
    lookup: createIndex(indexMap),
    get size() {
      return isProxy(this) ? indexMap.size : this.lookup.size
    },
    has(value: T) {
      const v = maybeProxify(value)
      return isProxy(this)
        ? indexMap.has(v)
        : this.lookup.positions[getIndexKey(v)] !== undefined
    },
    add(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
        indexMap.set(v, this.index)
        this.lookup.positions[getIndexKey(v)] = this.index
        this.lookup.entries[this.index] = ref({ key: v })
        this.data[this.index++] = v
        this.lookup.size++
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
      delete this.lookup.positions[getIndexKey(v)]
      delete this.lookup.entries[index]
      this.lookup.size--
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0 // empty array
      this.index = 0
      indexMap.clear()
      this.lookup.positions = Object.create(null)
      this.lookup.entries.length = 0
      this.lookup.size = 0
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

  const proxiedObject = proxy(vObject)
  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    index: { enumerable: false },
    lookup: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as InternalProxySet<T> & {
    $$valtioSnapshot: Omit<InternalProxySet<T>, 'set' | 'delete' | 'clear'>
  }
}

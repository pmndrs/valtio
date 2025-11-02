import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap, snapCache } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type RSetLike<T> = { has(value: T): boolean }

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: () => object
  index: number
  epoch: number
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
 *
 * @param {object} obj - The object to check
 * @returns {boolean} True if the object is a proxy Set, false otherwise
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
 * @template T - Type of the Set elements
 * @param {Iterable<T>} [initialValues] - Initial values to populate the Set
 * @returns {Set<T>} A reactive proxy Set with extended methods
 * @throws {TypeError} If initialValues is not iterable
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

  const snapMapCache = new WeakMap<object, Map<T, number>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapMapCache.has(latestSnap)) {
      const clonedMap = new Map(indexMap)
      snapMapCache.set(latestSnap, clonedMap)
    }
  }
  const getMapForThis = (x: any) => snapMapCache.get(x) || indexMap

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

  const hasIterator = (o: unknown): o is Iterable<unknown> =>
    typeof o === 'object' && o !== null && Symbol.iterator in (o as object)

  const hasForEach = <U>(o: RSetLike<U>): o is RSetLike<U> & { forEach: (cb: (v: U) => void) => void } =>
    typeof (o as { forEach?: unknown }).forEach === 'function'

  const asIterable = <U>(other: RSetLike<U> | Set<U>): Iterable<U> => {
    if (hasIterator(other)) return other as Iterable<U>
    if (hasForEach(other)) {
      const acc: U[] = []
      other.forEach((v) => acc.push(v))
      return acc
    }
    throw new TypeError('Expected an iterable')
  }

  function intersectionImpl<T, U>(this: InternalProxySet<T>, other: RSetLike<U>): Set<T & U>
  function intersectionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function intersectionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>
  ): Set<unknown> {
    this.epoch
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<T>()
    for (const value of this.values()) {
      if (otherSet.has(value)) {
        result.add(value)
      }
    }
    return proxySet(result)
  }

  function unionImpl<T, U>(this: InternalProxySet<T>, other: RSetLike<U>): Set<T | U>
  function unionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function unionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>
  ): Set<unknown> {
    this.epoch
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<unknown>()
    for (const v of this.values()) result.add(v)
    for (const v of otherSet.values()) result.add(v)
    return proxySet(result)
  }

  function differenceImpl<T, U>(this: InternalProxySet<T>, _other: RSetLike<U>): Set<T>
  function differenceImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function differenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>
  ): Set<T> {
    this.epoch
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<T>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    return proxySet(result)
  }

  function symmetricDifferenceImpl<T, U>(this: InternalProxySet<T>, other: RSetLike<U>): Set<T | U>
  function symmetricDifferenceImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function symmetricDifferenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>
  ): Set<unknown> {
    this.epoch
    const otherSet = proxySet(asIterable(other))
    const result = proxySet<unknown>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    for (const v of otherSet.values()) if (!this.has(v as T)) result.add(v)
    return proxySet(result)
  }



  const vObject: InternalProxySet<T> = {
    data: initialData,
    index: initialIndex,
    epoch: 0,
    get size() {
      if (!isProxy(this)) {
        registerSnapMap()
      }
      return indexMap.size
    },
    has(value: T) {
      const map = getMapForThis(this)
      const v = maybeProxify(value)
      this.epoch
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
        this.epoch++
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
      this.epoch++
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0
      this.index = 0
      this.epoch++
      indexMap.clear()
    },
    forEach(cb: (value: T, valueAgain: T, set: Set<T>) => void) {
      this.epoch
      const map = getMapForThis(this)
      map.forEach((index) => {
        cb(this.data[index]!, this.data[index]!, this)
      })
    },
    *values(): SetIterator<T> {
      this.epoch
      const map = getMapForThis(this)
      for (const index of map.values()) {
        yield this.data[index]!
      }
    },
    keys(): SetIterator<T> {
      this.epoch
      return this.values()
    },
    *entries(): SetIterator<[T, T]> {
      this.epoch
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
      this.epoch
      for (const v of this.values()) if (!other.has(v)) return false
      return true
    },
    isSupersetOf(other: RSetLike<T>) {
      this.epoch
      const it = asIterable(other)
      for (const v of it) if (!this.has(v)) return false
      return true
    },
    isDisjointFrom(other: RSetLike<T>) {
      this.epoch
      for (const v of this.values()) if (other.has(v)) return false
      return true
    },
  }

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

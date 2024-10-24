import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap, snapCache } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: object
  index: number
  epoch: number
  intersection: (other: Set<T>) => Set<T>
  isDisjointFrom: (other: Set<T>) => boolean
  isSubsetOf: (other: Set<T>) => boolean
  isSupersetOf: (other: Set<T>) => boolean
  symmetricDifference: (other: Set<T>) => Set<T>
  union: (other: Set<T>) => Set<T>
}

/**
 * proxySet
 *
 * This is to create a proxy which mimic the native Set behavior.
 * The API is the same as Set API
 *
 * @example
 * import { proxySet } from 'valtio/utils'
 * const state = proxySet([1,2,3])
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
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.epoch // touch property for tracking
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
      this.data.length = 0 // empty array
      this.index = 0
      this.epoch++
      indexMap.clear()
    },
    forEach(cb) {
      const map = getMapForThis(this)
      map.forEach((index) => {
        cb(this.data[index]!, this.data[index]!, this)
      })
    },
    *values(): IterableIterator<T> {
      const map = getMapForThis(this)
      for (const index of map.values()) {
        yield this.data[index]!
      }
    },
    keys(): IterableIterator<T> {
      return this.values()
    },
    *entries(): IterableIterator<[T, T]> {
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
    intersection(other: Set<T>): Set<T> {
      const otherSet = proxySet<T>(other)
      const resultSet = proxySet<T>()
      for (const value of this.values()) {
        if (otherSet.has(value)) {
          resultSet.add(value)
        }
      }
      return proxySet(resultSet)
    },
    isDisjointFrom(other: Set<T>): boolean {
      const otherSet = proxySet<T>(other)
      return (
        this.size === other.size &&
        [...this.values()].every((value) => !otherSet.has(value))
      )
    },
    isSubsetOf(other: Set<T>) {
      const otherSet = proxySet<T>(other)
      return (
        this.size <= other.size &&
        [...this.values()].every((value) => otherSet.has(value))
      )
    },
    isSupersetOf(other: Set<T>) {
      const otherSet = proxySet<T>(other)
      return (
        this.size >= other.size &&
        [...otherSet].every((value) => this.has(value))
      )
    },
    symmetricDifference(other: Set<T>) {
      const resultSet = proxySet<T>()
      const otherSet = proxySet<T>(other)
      for (const value of this.values()) {
        if (!otherSet.has(value)) {
          resultSet.add(value)
        }
      }
      return proxySet(resultSet)
    },
    union(other: Set<T>) {
      const resultSet = proxySet<T>()
      const otherSet = proxySet<T>(other)
      for (const value of this.values()) {
        resultSet.add(value)
      }
      for (const value of otherSet) {
        resultSet.add(value)
      }
      return proxySet(resultSet)
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

  return proxiedObject as unknown as InternalProxySet<T> & {
    $$valtioSnapshot: Omit<InternalProxySet<T>, 'set' | 'delete' | 'clear'>
  }
}

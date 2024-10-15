import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap, snapCache } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: object
  index: number
  intersection: (other: Set<T>) => Set<T>
  isDisjointFrom: (other: Set<T>) => boolean
  isSubsetOf: (other: Set<T>) => boolean
  isSupersetOf: (other: Set<T>) => boolean
  symmetricDifference: (other: Set<T>) => Set<T>
  union: (other: Set<T>) => Set<T>
}

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
    for (const v of initialValues) {
      if (!indexMap.has(v)) {
        const value = maybeProxify(v)
        indexMap.set(value, initialIndex)
        initialData[initialIndex++] = value
      }
    }
  }

  const vObject: InternalProxySet<T> = {
    data: initialData,
    index: initialIndex,
    get size() {
      if (!isProxy(this)) {
        registerSnapMap()
      }
      return indexMap.size
    },
    has(v: T) {
      const map = getMapForThis(this)
      const value = maybeProxify(v)
      const exists = map.has(value)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.index
      }
      return exists
    },
    add(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
        let nextIndex = this.index
        indexMap.set(v, nextIndex)
        this.data[nextIndex++] = v
        this.index = nextIndex
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
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0 // empty array
      this.index = 0
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
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as unknown as InternalProxySet<T> & {
    $$valtioSnapshot: Omit<InternalProxySet<T>, 'set' | 'delete' | 'clear'>
  }
}

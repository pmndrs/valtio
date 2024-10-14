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
      return true
    }
    return false
  }
  const getSnapMap = (x: any) => snapMapCache.get(x)

  if (initialValues !== null && typeof initialValues !== 'undefined') {
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
    add(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
        let nextIndex = this.index
        indexMap.set(v, nextIndex)
        this.data[nextIndex++] = v
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
      this.data.length = 0
      this.index = 0
      indexMap.clear()
    },
    forEach(cb) {
      const set = getSnapMap(this) || indexMap
      set.forEach((index) => {
        cb(this.data[index]!, this.data[index]!, this)
      })
    },
    has(v: T) {
      const iMap = getSnapMap(this) || indexMap
      const value = maybeProxify(v)
      const exists = iMap.has(value)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.index
      }
      return exists
    },
    *values(): IterableIterator<T> {
      const iMap = getSnapMap(this) || indexMap
      for (const index of iMap.values()) {
        yield this.data[index]!
      }
    },
    keys(): IterableIterator<T> {
      return this.values()
    },
    *entries(): IterableIterator<[T, T]> {
      const iMap = getSnapMap(this) || indexMap
      for (const index of iMap.values()) {
        const value = this.data[index]!
        yield [value, value]
      }
    },
    toJSON(): Set<T> {
      // filtering is about twice as fast as creating a new set and deleting
      // the undefined value because filter actually skips empty slots
      return new Set(this.data.filter((v) => v !== undefined) as T[])
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

import {
  proxy,
  snapshot,
  subscribe,
  unstable_getInternalStates,
} from '../../vanilla.ts'
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

  const unsubMap = new Map<object, () => void>()
  const snapSetCache = new WeakMap<object, Set<T>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapSetCache.has(latestSnap)) {
      const snapSet = new Set<T>()
      for (let i = 0; i < vObject.data.length; i++) {
        const t = vObject.data[i] as T
        snapSet.add(isProxy(t) ? (snapshot(t as object) as T) : t)
      }
      snapSetCache.set(latestSnap, snapSet)
      return true
    }
    return false
  }
  const getSnapSet = (x: any) => snapSetCache.get(x)

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
      registerSnapMap()
      return indexMap.size
    },
    add(value: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const v = maybeProxify(value)
      if (!indexMap.has(v)) {
        unsubMap.get(v)?.()
        unsubMap.delete(v)
        if (isProxy(v)) {
          unsubMap.set(
            v,
            subscribe(v, () => void this.index++, true),
          )
        }
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

      unsubMap.get(v)?.()
      unsubMap.delete(v)

      delete this.data[index]
      indexMap.delete(v)
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      for (const unsub of unsubMap.values()) {
        unsub()
      }
      unsubMap.clear()
      this.data.splice(0)
      this.index = 0
      indexMap.clear()
    },
    forEach(cb) {
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        indexMap.forEach((index) => {
          cb(this.data[index]!, this.data[index]!, this)
        })
      } else {
        return (set as Set<T>).forEach(cb)
      }
    },
    has(v: T) {
      const set = getSnapSet(this) || indexMap
      const value = maybeProxify(v)
      const exists = set.has(value)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.index
      }
      return exists
    },
    *values(): IterableIterator<T> {
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        for (const index of indexMap.values()) {
          yield this.data[index]!
        }
      } else {
        for (const v of set) {
          yield v as T
        }
      }
    },
    keys(): IterableIterator<T> {
      return this.values()
    },
    *entries(): IterableIterator<[T, T]> {
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        for (const index of indexMap.values()) {
          const value = this.data[index]!
          yield [value, value]
        }
      } else {
        for (const v of set) {
          yield [v as T, v as T]
        }
      }
    },
    toJSON(): Set<T> {
      // filtering is about twice as fast as creating a new set and deleting
      // the undefined value because filter actually skips empty slots
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        return new Set(this.data.filter((v) => v !== undefined) as T[])
      }
      return new Set(set as Set<T>)
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
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        for (const value of this.values()) {
          if (otherSet.has(value)) {
            resultSet.add(value)
          }
        }
      } else {
        for (const v of set) {
          if (otherSet.has(v as T)) {
            resultSet.add(v as T)
          }
        }
      }
      return proxySet(resultSet)
    },
    isDisjointFrom(other: Set<T>): boolean {
      const otherSet = proxySet<T>(other)
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        return (
          this.size === other.size &&
          [...this.values()].every((value) => !otherSet.has(value))
        )
      } else {
        return (
          set.size === other.size &&
          [...set].every((v) => !otherSet.has(v as T))
        )
      }
    },
    isSubsetOf(other: Set<T>) {
      const otherSet = proxySet<T>(other)
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        return (
          this.size <= other.size &&
          [...this.values()].every((value) => otherSet.has(value))
        )
      } else {
        return (
          set.size <= other.size && [...set].every((v) => otherSet.has(v as T))
        )
      }
    },
    isSupersetOf(other: Set<T>) {
      const otherSet = proxySet<T>(other)
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        return (
          this.size >= other.size &&
          [...otherSet].every((value) => this.has(value))
        )
      } else {
        return (
          set.size >= other.size && [...otherSet].every((v) => this.has(v as T))
        )
      }
    },
    symmetricDifference(other: Set<T>) {
      const resultSet = proxySet<T>()
      const otherSet = proxySet<T>(other)
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        for (const value of this.values()) {
          if (!otherSet.has(value)) {
            resultSet.add(value)
          }
        }
      } else {
        for (const v of set) {
          if (!otherSet.has(v as T)) {
            resultSet.add(v as T)
          }
        }
      }
      return proxySet(resultSet)
    },
    union(other: Set<T>) {
      const resultSet = proxySet<T>()
      const otherSet = proxySet<T>(other)
      const set = getSnapSet(this) || indexMap
      if (set === indexMap) {
        for (const value of this.values()) {
          resultSet.add(value)
        }
        for (const value of otherSet) {
          resultSet.add(value)
        }
      } else {
        for (const v of set) {
          resultSet.add(v as T)
        }
        for (const v of otherSet) {
          resultSet.add(v as T)
        }
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

// eslint-disable-next-line import/extensions
import { proxy, unstable_getInternalStates } from '../../vanilla'
const { proxyStateMap } = unstable_getInternalStates()
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
      return indexMap.size
    },
    add(v: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const value = maybeProxify(v)
      if (!indexMap.has(value)) {
        let nextIndex = this.index
        indexMap.set(value, nextIndex)
        this.data[nextIndex++] = value
      }
      return this
    },
    delete(v: T) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const value = maybeProxify(v)
      const index = indexMap.get(value)
      if (index !== undefined) {
        delete this.data[index]
        indexMap.delete(value)
        return true
      }
      return false
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.splice(0)
      this.index = 0
      indexMap.clear()
    },
    forEach(cb) {
      indexMap.forEach((index) => {
        cb(this.data[index]!, this.data[index]!, this)
      })
    },
    has(v: T) {
      const value = maybeProxify(v)
      if (indexMap.has(value)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
        return true
      }
      return false
    },
    *values(): IterableIterator<T> {
      for (const index of indexMap.values()) {
        yield this.data[index]!
      }
    },
    keys(): IterableIterator<T> {
      return this.values()
    },
    *entries(): IterableIterator<[T, T]> {
      for (const index of indexMap.values()) {
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
      for (const value of other) {
        if (!this.has(value)) {
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

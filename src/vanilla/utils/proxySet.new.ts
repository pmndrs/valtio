import { proxy } from 'valtio'

const canProxy = (x: unknown): boolean => {
  const p = proxy({} as { x: unknown })
  p.x = x
  return p.x !== x
}

const maybeProxify = (v: any) => {
  if (canProxy(v)) {
    const pv = proxy(v)
    if (pv !== v) {
      return pv
    }
  }
  return v
}

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: object
  intersection: (other: Set<T>) => Set<T>
  isDisjointFrom: (other: Set<T>) => boolean
  isSubsetOf: (other: Set<T>) => boolean
  isSupersetOf: (other: Set<T>) => boolean
  symmetricDifference: (other: Set<T>) => Set<T>
  union: (other: Set<T>) => Set<T>
}

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const data: T[] = []
  const indexMap = new Map<T, number>()

  if (initialValues !== null && typeof initialValues !== 'undefined') {
    if (typeof initialValues[Symbol.iterator] !== 'function') {
      throw new Error('proxySet:\n\tinitial state must be iterable')
    }
    for (const v of initialValues) {
      if (!indexMap.has(v)) {
        const value = maybeProxify(v)
        indexMap.set(value, data.length)
        data.push(value)
      }
    }
  }

  const vObject: InternalProxySet<T> = {
    data: [],
    get size() {
      return indexMap.size
    },
    add(value: T) {
      if (!indexMap.has(value)) {
        const index = data.length
        data.push(value)
        indexMap.set(value, index)
      }
      return this
    },
    delete(value: T) {
      const index = indexMap.get(value)
      if (index !== undefined) {
        delete data[index]
        indexMap.delete(value)
        return true
      }
      return false
    },
    clear() {
      data.splice(0)
      indexMap.clear()
    },
    forEach(cb) {
      indexMap.forEach((index) => {
        cb(data[index]!, data[index]!, this)
      })
    },
    has(value: T) {
      return indexMap.has(value)
    },
    *values(): IterableIterator<T> {
      for (const index of indexMap.values()) {
        yield data[index]!
      }
    },
    keys(): IterableIterator<T> {
      return this.values()
    },
    *entries(): IterableIterator<[T, T]> {
      for (const index of indexMap.values()) {
        const value = data[index]!
        yield [value, value]
      }
    },
    toJSON(): Set<T> {
      return new Set(data.filter((v) => v !== undefined) as T[])
    },
    [Symbol.iterator]() {
      return this.values()
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    intersection(other: Set<T>): Set<T> {
      const resultSet = new Set<T>()
      for (const value of this.values()) {
        if (other.has(value)) {
          resultSet.add(value)
        }
      }
      return proxySet(resultSet)
    },
    isDisjointFrom(other: Set<T>): boolean {
      return (
        this.size === other.size &&
        [...this.values()].every((value) => !other.has(value))
      )
    },
    isSubsetOf(other: Set<T>) {
      return (
        this.size <= other.size &&
        [...this.values()].every((value) => other.has(value))
      )
    },
    isSupersetOf(other: Set<T>) {
      return (
        this.size >= other.size && [...other].every((value) => this.has(value))
      )
    },
    symmetricDifference(other: Set<T>) {
      const resultSet = new Set<T>()
      for (const value of this.values()) {
        if (!other.has(value)) {
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
      const resultSet = new Set<T>()
      for (const value of this.values()) {
        resultSet.add(value)
      }
      for (const value of other) {
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

  return proxiedObject as unknown as Set<T> & {
    $$valtioSnapshot: Omit<Set<T>, 'set' | 'delete' | 'clear'>
  }
}

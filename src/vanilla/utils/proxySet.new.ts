import { proxy } from '../../vanilla.ts'

type SetMethods<O> = {
  intersection(other: Set<O>): Set<O>
  isDisjointFrom(other: Set<O>): boolean
  isSubsetOf(other: Set<O>): boolean
  isSupersetOf(other: Set<O>): boolean
  symmetricDifference(other: Set<O>): Set<O>
  union(other: Set<O>): Set<O>
}

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

const sameValueZeroEqauals = (x: any, y: any) => {
    if (typeof x === 'number' && typeof y === 'number') {
      // x and y are equal (may be -0 and 0) or they are both NaN
      return x === y || (x !== x && y !== y)
    }
    return x === y
  },
  eq = sameValueZeroEqauals

// Set.prototype.add()
// Set.prototype.clear()
// Set.prototype.delete()
// Set.prototype.difference()
// Set.prototype.entries()
// Set.prototype.forEach()
// Set.prototype.has()
// Set.prototype.intersection()
// Set.prototype.isDisjointFrom()
// Set.prototype.isSubsetOf()
// Set.prototype.isSupersetOf()
// Set.prototype.keys()
// Set.prototype[Symbol.iterator]()
// Set.prototype.symmetricDifference()
// Set.prototype.union()
// Set.prototype.values()
// Set.prototype.size

type InternalProxySet<T> = Set<T> & {
  data: Array<[T]>
  size: number
  toJSON: () => Set<T>
}

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const indexMap = new Map<T, number>()
  const data = []

  if (initialValues !== null && typeof initialValues !== 'undefined') {
    if (typeof initialValues[Symbol.iterator] !== 'function') {
      throw new Error(
        'proxySet: initial state must be iterable\n\t\ttip: structure should be [value]',
      )
    }
    for (const v of initialValues) {
      const value = maybeProxify(v)
      if (!indexMap.has(value)) {
        console.warn('proxySet: duplicate value')
      }
      indexMap.set(value, data.length)
      data.push(value)
    }
  } else {
    throw new Error('proxySet: initial state must be iterable')
  }
  // Remove this closing brace }

  const sObject: InternalProxySet<T> = {
    data,
    get size() {
      return this.data.length
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    add(value: T) {
      if (!indexMap.has(value)) {
        this.data.push(value)
      }
    },
    clear() {
      setProxy.clear()
      this[versionSymbol]++
      return
    },
    delete(value) {
      const result = set.delete(value)
      if (result) {
        this[versionSymbol]++
        return true
      } else {
        return false
      }
    },
    entries() {
      return set.entries()
    },
    forEach(cb: (value: T, key: any, set: Set<T>) => void) {
      return setProxy.forEach((value, key, set) => {
        cb(value, key, this)
      })
    },
    has(value) {
      return set.has(value)
    },
    keys() {
      return set.keys()
    },
    values() {
      return set.values()
    },
    toJSON() {
      return new Set(setProxy)
    },
    // intersection(other: Set<T>): Set<T> {
    //   const resultSet = set.intersection(other)
    //   return proxySet(resultSet as Set<T>)
    // },
    // isDisjointFrom(other: Set<T>): boolean {
    //   return set.isDisjointFrom(other)
    // },
    // isSubsetOf(other: Set<T>) {
    //   return set.isSubsetOf(other)
    // },
    // isSupersetOf(other: Set<T>) {
    //   return set.isSupersetOf(other)
    // },
    // symmetricDifference(other: Set<T>) {
    //   return proxySet(set.symmetricDifference(other))
    // },
    // union(other: Set<T>) {
    //   return proxySet(set.union(other))
    // },
  }

  Object.defineProperties(sObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(sObject)

  const proxiedObject = proxy(sObject)

  return proxiedObject as unknown as Set<T> & {
    $$valtioSnapshot: Omit<Set<T>, 'add' | 'delete' | 'clear'>
  }
}

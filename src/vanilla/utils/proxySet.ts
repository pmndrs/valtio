import { proxy } from '../../vanilla.ts'

type InternalProxySet<T> = Set<T> & {
  [versionSymbol]: number
}
type SetMethods<O> = {
  intersection(other: Set<O>): Set<O>
  isDisjointFrom(other: Set<O>): boolean
  isSubsetOf(other: Set<O>): boolean
  isSupersetOf(other: Set<O>): boolean
  symmetricDifference(other: Set<O>): Set<O>
  union(other: Set<O>): Set<O>
}

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

const versionSymbol = Symbol('version')

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const set = new Set(initialValues ? [...initialValues] : [])

  const setProxy = new Proxy(set, {
    get(target, prop) {
      let value = Reflect.get(target, prop)
      if (typeof value === 'function') {
        value = value.bind(set)
      }
      return value
    },
    set(target, prop, value, _receiver) {
      return Reflect.set(target, prop, value)
    },
  })

  const setObject: InternalProxySet<T> = {
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    get size() {
      return setProxy.size
    },
    [Symbol.iterator]() {
      return setProxy[Symbol.iterator]()
    },
    [versionSymbol]: 0,
    add(value) {
      this[versionSymbol]++
      setProxy.add(value)
      return this
    },
    clear() {
      this[versionSymbol]++
      return setProxy.clear()
    },
    delete(value) {
      this[versionSymbol]++
      return set.delete(value)
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

  Object.defineProperties(setObject, {
    [versionSymbol]: { enumerable: false },
    size: { enumerable: false },
  })
  Object.seal(setObject)

  const proxiedObject = proxy(setObject)

  return proxiedObject as unknown as Set<T> & {
    $$valtioSnapshot: Omit<Set<T>, 'add' | 'delete' | 'clear'>
  }
}

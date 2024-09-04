import { proxy } from '../../vanilla.ts'

type InternalProxySet<T> = Set<T> & {
  data: T[]
  toJSON: object
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

class subSet<T> extends Set<T> implements SetMethods<T> {
  constructor(iterable: Iterable<T> = []) {
    super(iterable)
  }

  intersection(other: Set<T>) {
    return new Set([...this].filter((value) => other.has(value)))
  }
  isDisjointFrom(other: Set<T>) {
    return [...this].every((value) => !other.has(value))
  }
  isSubsetOf(other: Set<T>) {
    return [...this].every((value) => other.has(value))
  }
  isSupersetOf(other: Set<T>) {
    return [...other].every((value) => this.has(value))
  }
  symmetricDifference(other: Set<T>) {
    return new Set(
      [...this]
        .filter((value) => !other.has(value))
        .concat([...other].filter((value) => !this.has(value))),
    )
  }
  union<T>(other: Set<T>) {
    return new Set([...this, ...other])
  }
}

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const set = new subSet(initialValues ? [...initialValues] : [])
  const setProxy: InternalProxySet<T> & SetMethods<T> = proxy<
    InternalProxySet<T> & SetMethods<T>
  >({
    get data() {
      return Array.from(new Set(initialValues))
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    get size() {
      return set.size
    },
    [Symbol.iterator]() {
      return set[Symbol.iterator]()
    },
    add(value) {
      set.add(value)
      return setProxy
    },
    clear() {
      set.clear()
    },
    delete(value) {
      return set.delete(value)
    },
    entries() {
      return set.entries()
    },
    forEach(cb: (value: T, key: any, set: Set<T>) => void) {
      return set.forEach(
        (value: T, key: any) => cb(value, key, setProxy),
        setProxy,
      )
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
      return new Set(this.data)
    },
    intersection(other: Set<T>): Set<T> {
      const resultSet = set.intersection(other)
      return proxySet(resultSet as Set<T>)
    },
    isDisjointFrom(other: Set<T>): boolean {
      return set.isDisjointFrom(other)
    },
    isSubsetOf(other: Set<T>) {
      return set.isSubsetOf(other)
    },
    isSupersetOf(other: Set<T>) {
      return set.isSupersetOf(other)
    },
    symmetricDifference(other: Set<T>) {
      return proxySet(set.symmetricDifference(other))
    },
    union(other: Set<T>) {
      return proxySet(set.union(other))
    },
  })

  Object.defineProperties(setProxy, {
    data: { enumerable: false },
    size: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(setProxy)

  return setProxy as unknown as Set<T> & {
    $$valtioSnapshot: Omit<Set<T>, 'add' | 'delete' | 'clear'>
  }
}

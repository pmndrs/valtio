import { proxy } from '../../vanilla.ts'

// properties that we don't want to expose to the end-user
type InternalProxySet<T> = Set<T> & {
  data: boolean
  toJSON: object
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
 * //can be used inside a proxy as well
 * const state = proxy({
 *   count: 1,
 *   set: proxySet()
 * })
 */
export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const s = new Set(initialValues)
  const set: InternalProxySet<T> = proxy({
    data: false as boolean,
    has(value) {
      return s.has(value)
    },
    add(value) {
      s.add(value)
      this.data = !this.data
      return this
    },
    delete(value) {
      const result = s.delete(value)
      if (result) {
        this.data = !this.data
      }
      return result
    },
    clear() {
      s.clear()
      this.data = !this.data
    },
    get size() {
      return s.size
    },
    forEach(cb) {
      s.forEach(cb)
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    toJSON() {
      return new Set(s)
    },
    [Symbol.iterator]() {
      return s[Symbol.iterator]()
    },
    values() {
      return s.values()
    },
    keys() {
      // for Set.keys is an alias for Set.values()
      return s.keys()
    },
    entries() {
      return s.entries()
    },
  })

  Object.defineProperties(set, {
    data: {
      enumerable: false,
    },
    size: {
      enumerable: false,
    },
    toJSON: {
      enumerable: false,
    },
  })

  Object.seal(set)

  return set as unknown as Set<T> & {
    $$valtioSnapshot: Omit<Set<T>, 'add' | 'delete' | 'clear'>
  }
}

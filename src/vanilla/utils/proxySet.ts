import {
  isProxyObject,
  proxy,
  unstable_getInternalStates,
} from '../../vanilla.js'
import { advanceFirst, keyId, slotsOf } from './collection.js'

const { batchAsWrite } = unstable_getInternalStates()

// The index of the set. It is part of the state, so a snapshot has its own:
// the id of a member gives its slot in `data`, `size` counts the members, and
// `first` is the first slot in use. A slot is never used again, so
// `data.length` is the next.
type Lookup = {
  size: number
  first: number
  [id: string | symbol]: number
}

type RSetLike<T> = { has(value: T): boolean }

type InternalProxySet<T> = Set<T> & {
  data: T[]
  lookup: Lookup
  toJSON: () => object
  intersection<U>(other: RSetLike<U>): Set<T & U>
  intersection(other: Set<T>): Set<T>
  union<U>(other: RSetLike<U>): Set<T | U>
  union(other: Set<T>): Set<T>
  difference<U>(other: RSetLike<U>): Set<T>
  difference(other: Set<T>): Set<T>
  symmetricDifference<U>(other: RSetLike<U>): Set<T | U>
  symmetricDifference(other: Set<T>): Set<T>
  isSubsetOf(other: RSetLike<T>): boolean
  isSupersetOf(other: RSetLike<T>): boolean
  isDisjointFrom(other: RSetLike<T>): boolean
}

/**
 * Determines if an object is a proxy Set created with proxySet
 */
export const isProxySet = (obj: object): boolean => {
  return (
    Symbol.toStringTag in obj &&
    obj[Symbol.toStringTag] === 'Set' &&
    isProxyObject(obj)
  )
}

/**
 * Creates a reactive Set that integrates with Valtio's proxy system
 *
 * This utility creates a Set-like object that works with Valtio's reactivity system,
 * allowing you to track changes to the Set in the same way as regular proxy objects.
 * The API extends the standard JavaScript Set with additional set operations like
 * union, intersection, difference, etc.
 *
 * @example
 * import { proxySet } from 'valtio/utils'
 * const state = proxySet([1,2,3])
 *
 * // can be used inside a proxy as well
 * const state = proxy({
 *   count: 1,
 *   set: proxySet()
 * })
 */

export function proxySet<T>(initialValues?: Iterable<T> | null) {
  const initialData: T[] = []
  const initialLookup: Lookup = { size: 0, first: 0 }

  if (initialValues) {
    if (typeof initialValues[Symbol.iterator] !== 'function') {
      throw new TypeError('not iterable')
    }
    for (const value of initialValues) {
      const id = keyId(value)
      if (initialLookup[id] === undefined) {
        initialLookup[id] = initialData.length
        initialLookup.size++
        initialData.push(value)
      }
    }
  }

  const asIterable = <U>(other: RSetLike<U> | Set<U>): Iterable<U> => {
    if (
      typeof other === 'object' &&
      other !== null &&
      Symbol.iterator in other
    ) {
      return other as Iterable<U>
    }
    throw new TypeError('Expected an iterable')
  }

  // A set operation on a proxy builds proxySets. A snapshot's members are
  // snapshots, which a proxySet can't hold, so there it builds plain sets,
  // with each value replaced by the snapshot's own member if it has one.
  const setFor = (
    self: InternalProxySet<any>,
  ): (<V>(values?: Iterable<V>) => Set<V>) =>
    isProxyObject(self)
      ? proxySet
      : (values) =>
          new Set(
            values &&
              Array.from(values, (value) => {
                const slot = self.lookup[keyId(value)]
                return slot === undefined ? value : self.data[slot]
              }),
          )

  function intersectionImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T & U>
  function intersectionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function intersectionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const newSet = setFor(this)
    const otherSet = newSet(asIterable(other))
    const result = newSet<T>()
    for (const value of this.values()) {
      if (otherSet.has(value)) {
        result.add(value)
      }
    }
    return result
  }

  function unionImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T | U>
  function unionImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function unionImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const newSet = setFor(this)
    const otherSet = newSet(asIterable(other))
    const result = newSet<unknown>()
    for (const v of this.values()) result.add(v)
    for (const v of otherSet.values()) result.add(v)
    return result
  }

  function differenceImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T>
  function differenceImpl<T>(this: InternalProxySet<T>, other: Set<T>): Set<T>
  function differenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<T> {
    const newSet = setFor(this)
    const otherSet = newSet(asIterable(other))
    const result = newSet<T>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    return result
  }

  function symmetricDifferenceImpl<T, U>(
    this: InternalProxySet<T>,
    other: RSetLike<U>,
  ): Set<T | U>
  function symmetricDifferenceImpl<T>(
    this: InternalProxySet<T>,
    other: Set<T>,
  ): Set<T>
  function symmetricDifferenceImpl<T>(
    this: InternalProxySet<T>,
    other: RSetLike<unknown> | Set<T>,
  ): Set<unknown> {
    const newSet = setFor(this)
    const otherSet = newSet(asIterable(other))
    const result = newSet<unknown>()
    for (const v of this.values()) if (!otherSet.has(v)) result.add(v)
    // (v as T) -> v is unknown from RSetLike<unknown>, but has() accepts T and safely handles type mismatches
    for (const v of otherSet.values()) if (!this.has(v as T)) result.add(v)
    return result
  }

  const vObject: InternalProxySet<T> = {
    data: initialData,
    lookup: initialLookup,
    get size() {
      return this.lookup.size
    },
    has(value: T) {
      return this.lookup[keyId(value)] !== undefined
    },
    add(value: T) {
      if (!isProxyObject(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const id = keyId(value)
      if (this.lookup[id] === undefined) {
        batchAsWrite(() => {
          const slot = this.data.length
          // The value is set first, because a snapshot makes it throw.
          this.data[slot] = value
          this.lookup[id] = slot
          this.lookup.size++
        })
      }
      return this
    },
    delete(value: T) {
      if (!isProxyObject(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const id = keyId(value)
      const slot = this.lookup[id]
      if (slot === undefined) {
        return false
      }
      batchAsWrite(() => {
        delete this.data[slot]
        delete this.lookup[id]
        this.lookup.size--
        if (slot === this.lookup.first) {
          advanceFirst(this)
        }
      })
      return true
    },
    clear() {
      if (!isProxyObject(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      if (this.lookup.size) {
        batchAsWrite(() => {
          this.data = []
          this.lookup = { size: 0, first: 0 }
        })
      }
    },
    forEach(cb: (value: T, valueAgain: T, set: Set<T>) => void) {
      for (const value of this.values()) {
        cb(value, value, this)
      }
    },
    *values(): ReturnType<Set<T>['values']> {
      for (const slot of slotsOf(this)) {
        yield this.data[slot]!
      }
    },
    keys(): ReturnType<Set<T>['keys']> {
      return this.values()
    },
    *entries(): ReturnType<Set<T>['entries']> {
      for (const value of this.values()) {
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
    intersection: intersectionImpl,
    union: unionImpl,
    difference: differenceImpl,
    symmetricDifference: symmetricDifferenceImpl,
    isSubsetOf(other: RSetLike<T>) {
      for (const v of this.values()) if (!other.has(v)) return false
      return true
    },
    isSupersetOf(other: RSetLike<T>) {
      for (const v of asIterable(other)) if (!this.has(v)) return false
      return true
    },
    isDisjointFrom(other: RSetLike<T>) {
      for (const v of this.values()) if (other.has(v)) return false
      return true
    },
  }

  const proxiedObject = proxy(vObject)
  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    lookup: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as InternalProxySet<T> & {
    $$valtioSnapshot: Omit<InternalProxySet<T>, 'set' | 'delete' | 'clear'>
  }
}

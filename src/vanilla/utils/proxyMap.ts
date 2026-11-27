import {
  isProxyObject,
  proxy,
  ref,
  unstable_getInternalStates,
} from '../../vanilla.js'
import { advanceFirst, keyId, slotsOf } from './collection.js'

const { batchAsWrite } = unstable_getInternalStates()

// The index of the map. It is part of the state, so a snapshot has its own:
// the id of a key gives its slot in `data`, a slot gives its key, `size`
// counts the keys, and `first` is the first slot in use. A slot is never used
// again, so `data.length` is the next.
type Lookup<K> = {
  size: number
  first: number
  [slot: number]: { key: K }
  [id: string | symbol]: unknown
}

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<V>
  lookup: Lookup<K>
  toJSON: () => Map<K, V>
}

/**
 * Determines if an object is a proxy Map created with proxyMap
 */
export const isProxyMap = (obj: object): boolean => {
  return (
    Symbol.toStringTag in obj &&
    obj[Symbol.toStringTag] === 'Map' &&
    isProxyObject(obj)
  )
}

/**
 * Creates a reactive Map that integrates with Valtio's proxy system
 *
 * This utility creates a Map-like object that works with Valtio's reactivity system,
 * allowing you to track changes to the Map in the same way as regular proxy objects.
 * The API is the same as the standard JavaScript Map.
 *
 * @example
 * import { proxyMap } from 'valtio/utils'
 * const state = proxyMap([["key", "value"]])
 *
 * This can be used inside a proxy as well
 *
 * const state = proxy({
 *   count: 1,
 *   map: proxyMap()
 * })
 *
 * A key isn't proxied. An object key is found by the object, by its proxy or
 * by a snapshot of it.
 *
 * const key = {}
 * state.set(key, "value")
 * state.get(key) //value
 */
export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<V> = []
  const initialLookup: Lookup<K> = { size: 0, first: 0 }

  if (entries) {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [key, value] of entries) {
      const id = keyId(key)
      let slot = initialLookup[id] as number | undefined
      if (slot === undefined) {
        slot = initialData.length
        initialLookup[id] = slot
        initialLookup[slot] = ref({ key })
        initialLookup.size++
      }
      initialData[slot] = value
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    lookup: initialLookup,
    get size() {
      return this.lookup.size
    },
    get(key: K) {
      const slot = this.lookup[keyId(key)] as number | undefined
      return slot === undefined ? undefined : this.data[slot]
    },
    has(key: K) {
      return this.lookup[keyId(key)] !== undefined
    },
    set(key: K, value: V) {
      if (!isProxyObject(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const id = keyId(key)
      const slot = this.lookup[id] as number | undefined
      if (slot === undefined) {
        batchAsWrite(() => {
          const newSlot = this.data.length
          // The value is set first, because a snapshot makes it throw.
          this.data[newSlot] = value
          this.lookup[id] = newSlot
          this.lookup[newSlot] = ref({ key })
          this.lookup.size++
        })
      } else {
        this.data[slot] = value
      }
      return this
    },
    delete(key: K) {
      if (!isProxyObject(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const id = keyId(key)
      const slot = this.lookup[id] as number | undefined
      if (slot === undefined) {
        return false
      }
      batchAsWrite(() => {
        delete this.data[slot]
        delete this.lookup[id]
        delete this.lookup[slot]
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
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      for (const [key, value] of this.entries()) {
        cb(value, key, this)
      }
    },
    *entries(): ReturnType<Map<K, V>['entries']> {
      for (const slot of slotsOf(this)) {
        yield [this.lookup[slot]!.key, this.data[slot]!]
      }
    },
    *keys(): ReturnType<Map<K, V>['keys']> {
      for (const slot of slotsOf(this)) {
        yield this.lookup[slot]!.key
      }
    },
    *values(): ReturnType<Map<K, V>['values']> {
      for (const slot of slotsOf(this)) {
        yield this.data[slot]!
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map(this.entries())
    },
    // [ONLY-TS-5.9.3] [ONLY-TS-5.8.3] [ONLY-TS-5.7.3] [ONLY-TS-5.6.3] [ONLY-TS-5.5.4] @ts-expect-error ignore
    getOrInsert() {
      throw new Error('not implemented')
    },
    getOrInsertComputed() {
      throw new Error('not implemented')
    },
  }

  const proxiedObject = proxy(vObject)
  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    lookup: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

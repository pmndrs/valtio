import { isProxyObject as isProxy, proxy, ref } from '../../vanilla.js'
import { clearIndex, createIndex, getIndexKey } from './collectionIndex.js'

const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<V>
  index: number
  lookup: ReturnType<typeof createIndex<K>>
  toJSON: () => Map<K, V>
}

/**
 * Determines if an object is a proxy Map created with proxyMap
 */
export const isProxyMap = (obj: object): boolean => {
  return (
    Symbol.toStringTag in obj &&
    obj[Symbol.toStringTag] === 'Map' &&
    isProxy(obj)
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
 * When using an object as a key, you can wrap it with `ref` so it's not proxied
 * this is useful if you want to preserve the key equality
 *
 * import { ref } from 'valtio'
 *
 * const key = ref({})
 * state.set(key, "value")
 * state.get(key) //value
 *
 * const key = {}
 * state.set(key, "value")
 * state.get(key) //undefined
 */
export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<V> = []
  let initialIndex = 0
  const indexMap = new Map<K, number>()

  const indexes = new WeakMap<object, Map<K, number>>()
  const getMapForThis = (x: any) => {
    if (isProxy(x)) return indexMap
    const entries = x.lookup
    entries.version
    let map = indexes.get(entries)
    if (!map) {
      map = new Map()
      Object.keys(entries).forEach((key) => {
        const entry = entries[key]
        if (typeof entry === 'object' && entry !== null) {
          map!.set(entry.key, +key)
        }
      })
      indexes.set(entries, map)
    }
    return map
  }

  const getIndexForThis = (x: any, key: K) => {
    if (isProxy(x)) return indexMap.get(key)
    x.lookup.version
    return x.lookup[getIndexKey(key)] as number | undefined
  }

  if (entries) {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [key, value] of entries) {
      const index = indexMap.get(key) ?? initialIndex++
      indexMap.set(key, index)
      initialData[index] = value
    }
  }

  const lookup = createIndex(indexMap)
  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    index: initialIndex,
    lookup,
    get size() {
      if (isProxy(this)) return indexMap.size
      this.lookup.version
      return this.lookup.size
    },
    get(key: K) {
      const index = getIndexForThis(this, key)
      if (index === undefined) {
        return undefined
      }
      return this.data[index]
    },
    has(key: K) {
      return getIndexForThis(this, key) !== undefined
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const index = indexMap.get(key)
      if (index === undefined) {
        indexMap.set(key, this.index)
        lookup[getIndexKey(key)] = this.index
        lookup[this.index] = ref({ key })
        this.data[this.index++] = value
        lookup.size++
        this.lookup.version++
      } else {
        this.data[index] = maybeProxify(value)
      }
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const index = indexMap.get(key)
      if (index === undefined) {
        return false
      }
      delete this.data[index]
      indexMap.delete(key)
      delete lookup[getIndexKey(key)]
      delete lookup[index]
      lookup.size--
      this.lookup.version++
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.data.length = 0 // empty array
      this.index = 0
      indexMap.clear()
      clearIndex(lookup)
      this.lookup.version++
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      const map = getMapForThis(this)
      map.forEach((index, key) => {
        cb(this.data[index]!, key, this)
      })
    },
    *entries(): ReturnType<Map<K, V>['entries']> {
      const map = getMapForThis(this)
      for (const [key, index] of map) {
        yield [key, this.data[index]!]
      }
    },
    *keys(): ReturnType<Map<K, V>['keys']> {
      const map = getMapForThis(this)
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): ReturnType<Map<K, V>['values']> {
      const map = getMapForThis(this)
      for (const index of map.values()) {
        yield this.data[index]!
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
    index: { enumerable: false },
    lookup: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

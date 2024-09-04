import { proxy, ref } from 'valtio'
/**
 * Instance methods
 *   Map.prototype.clear()
 *   Map.prototype.delete()
 *   Map.prototype.entries()
 *   Map.prototype.forEach()
 *   Map.prototype.get()
 *   Map.prototype.has()
 *   Map.prototype.keys()
 *   Map.prototype.set()
 *   Map.prototype[Symbol.iterator]()
 *   Map.prototype.values()
 * Instance properties
 *   Map.prototype.size
 **/
type KeyValRecord<K, V> = [key: K, value: V]

type InternalProxyMap<K, V> = Map<K, V> & {
  data: KeyValRecord<K, V>[]
  toJSON: object
}

class subMap<K, V> extends Map<K, V> {
  constructor(iterable: Iterable<[K, V]> = []) {
    super(iterable)
  }
}
export function proxyMap<K, V>(entries?: Iterable<[K, V]> | null) {
  const map = new subMap(entries ? [...entries] : [])
  const mapProxy = proxy<InternalProxyMap<K, V>>({
    [Symbol.iterator](): IterableIterator<[K, V]> {
      return map[Symbol.iterator]()
    },

    get [Symbol.toStringTag]() {
      return 'Map'
    },

    get data() {
      return Array.from(map.entries())
    },

    get size() {
      return map.size
    },

    toJSON() {
      return new Map(this.data)
    },

    clear() {
      map.clear()
    },

    delete(key: K) {
      return map.delete(key)
    },

    entries() {
      return map.entries()
    },

    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      return map.forEach((value, key) => cb(value, key, mapProxy), mapProxy)
    },

    get(key: K): V | undefined {
      const value = map.get(key)
      ;(mapProxy as any)[key] = value
      return (mapProxy as any)[key]
    },

    has(key: K) {
      return map.has(key)
    },

    keys() {
      return map.keys()
    },

    set(key: K, value: V): any {
      map.set(key, value)
      return mapProxy
    },

    values() {
      return map.values()
    },
  })

  Object.defineProperties(mapProxy, {
    data: { enumerable: false },
    size: { enumerable: false },
    toJSON: { enumerable: false },
  })
  Object.seal(mapProxy)

  return mapProxy as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

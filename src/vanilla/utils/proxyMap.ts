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

const versionSymbol = Symbol('version')

type InternalProxyObject<K, V> = Map<K, V> & {
  [versionSymbol]: number
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | null) {
  const map = new Map(entries ? [...entries] : [])

  const mapProxy = new Proxy(map, {
    get(target, prop) {
      let value = Reflect.get(target, prop)
      if (typeof value === 'function') {
        value = value.bind(map)
      }
      return value
    },
    set(target, prop, value, _receiver) {
      return Reflect.set(target, prop, value)
    },
  })

  const vObject: InternalProxyObject<K, V> = {
    get size() {
      return mapProxy.size
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    [versionSymbol]: 0,
    set(key, value) {
      this[versionSymbol]++
      mapProxy.set(key, value)
      return this
    },
    get(key) {
      return mapProxy.get(key)
    },
    clear() {
      this[versionSymbol]++
      return mapProxy.clear()
    },
    entries() {
      return mapProxy.entries()
    },
    forEach(cb) {
      return mapProxy.forEach((value, key, map) => {
        cb(value, key, this)
      })
    },
    delete(key) {
      this[versionSymbol]++
      return mapProxy.delete(key)
    },
    has(key) {
      return mapProxy.has(key)
    },
    values() {
      return mapProxy.values()
    },
    keys() {
      return mapProxy.keys()
    },
    [Symbol.iterator]() {
      return mapProxy[Symbol.iterator]()
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    [versionSymbol]: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject
}

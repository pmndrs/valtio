import { proxy, subscribe } from 'valtio'
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
  toJSON(): Map<K, V>,
  data: Array<[K, V]>
}

const subscriptions = new Map()

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
    data: Array.from(map.entries()),
    get size() {
      return mapProxy.size
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    [versionSymbol]: 0,
    set(key, value) {
      if (typeof value === 'object' && value !== null) {
        const proxied = proxy(value)
        mapProxy.set(key, proxied)
        const unsub = subscribe(
          proxied,
          () => {
            this[versionSymbol]++
          },
          true,
        )
        subscriptions.set(key, unsub)
      } else {
        mapProxy.set(key, value)
      }
      this[versionSymbol]++
      this.data = Array.from(map.entries())
      return this
    },
    get(key) {
      return map.get(key)
    },
    clear() {
      mapProxy.clear()
      subscriptions.clear()
      this[versionSymbol]++
      this.data = Array.from(map.entries())
      return
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
      const result = mapProxy.delete(key)
      subscriptions.get(key)?.()
      subscriptions.delete(key)
      this.data = Array.from(map.entries())
      if (result) {
        this[versionSymbol]++
        return true
      } else {
        return false
      }
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
    toJSON() {
      return new Map(mapProxy)
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    [versionSymbol]: { enumerable: false },
    toJSON: { enumerable: false },
    data: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject
}

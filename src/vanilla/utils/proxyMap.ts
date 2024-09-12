import { proxy } from '../../vanilla.ts'

const versionSymbol = Symbol('version')

type InternalProxyObject<K, V> = Map<K, V> & {
  [versionSymbol]: number
  toJSON(): Map<K, V>
  data: Array<[K, V]>
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
    data: Array.from(map.entries()),
    get size() {
      return mapProxy.size
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    [versionSymbol]: 0,
    set(key, value) {
      if (mapProxy.has(key)) {
        const index = this.data.findIndex(([k]) => k === key)
        this.data[index] = [key, value]
      } else {
        this.data.push([key, value])
      }
      console.log(this.data)
      mapProxy.set(key, value)
      this[versionSymbol]++
      return this
    },
    get(key) {
      return mapProxy.get(key)
    },
    clear() {
      mapProxy.clear()
      this[versionSymbol]++
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
      if (!mapProxy.has(key)) {
        return false
      }
      mapProxy.delete(key)
      const index = this.data.findIndex(([k]) => k === key)
      this.data.splice(index, 1)
      return true
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

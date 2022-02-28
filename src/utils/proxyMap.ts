import { proxy } from '../vanilla'

type KeyValRecord<K, V> = [key: K, value: V]

type InternalProxyMap<K, V> = Map<K, V> & {
  data: KeyValRecord<K, V>[]
  toJSON: object
}

/**
 * proxyMap
 *
 * This is to create a proxy which mimic the native Map behavior.
 * The API is the same as Map API
 *
 * @example
 * import { proxyMap } from 'valtio/utils'
 * const state = proxyMap([["key", "value"]])
 *
 * //can be used inside a proxy as well
 * const state = proxy({
 *   count: 1,
 *   map: proxyMap()
 * })
 *
 * // When using an object as a key, you can wrap it with `ref` so it's not proxied
 * // this is useful if you want to preserve the key equality
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
export function proxyMap<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): Map<K, V> {
  const map: InternalProxyMap<K, V> = proxy({
    data: Array.from(entries || []) as KeyValRecord<K, V>[],
    has(key) {
      return this.data.some((p) => p[0] === key)
    },
    set(key, value) {
      const record = this.data.find((p) => p[0] === key)
      if (record) {
        record[1] = value
      } else {
        this.data.push([key, value])
      }
      return this
    },
    get(key) {
      return this.data.find((p) => p[0] === key)?.[1]
    },
    delete(key) {
      const index = this.data.findIndex((p) => p[0] === key)
      if (index === -1) {
        return false
      }
      this.data.splice(index, 1)
      return true
    },
    clear() {
      this.data.splice(0)
    },
    get size() {
      return this.data.length
    },
    toJSON() {
      return {}
    },
    forEach(cb) {
      this.data.forEach((p) => {
        cb(p[1], p[0], this)
      })
    },
    keys() {
      return this.data.map((p) => p[0]).values()
    },
    values() {
      return this.data.map((p) => p[1]).values()
    },
    entries() {
      return new Map(this.data).entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    [Symbol.iterator]() {
      return this.entries()
    },
  })

  Object.defineProperties(map, {
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
  Object.seal(map)

  return map as Map<K, V>
}

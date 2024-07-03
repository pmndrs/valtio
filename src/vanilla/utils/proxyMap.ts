import { proxy } from '../../vanilla.ts'

type InternalProxyMap<K, V> = Map<K, V> & {
  data: boolean
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
export function proxyMap<K, V>(entries?: Iterable<readonly [K, V]> | null) {
  const m = new Map(entries)
  const map: InternalProxyMap<K, V> = proxy({
    data: false as boolean,
    has(key) {
      return m.has(key)
    },
    set(key, value) {
      m.set(key, value)
      this.data = !this.data
      return this
    },
    get(key) {
      return m.get(key)
    },
    delete(key) {
      const result = m.delete(key)
      if (result) {
        this.data = !this.data
      }
      return result
    },
    clear() {
      m.clear()
      this.data = !this.data
    },
    get size() {
      return m.size
    },
    toJSON() {
      return new Map(m)
    },
    forEach(cb) {
      m.forEach(cb)
    },
    keys() {
      return m.keys()
    },
    values() {
      return m.values()
    },
    entries() {
      return m.entries()
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

  return map as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

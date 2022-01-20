import { proxy } from 'valtio'

type KeyValRecord<K, V> = {
  key: K
  value: V
}

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
export const proxyMap = <K, V>(
  entries: Iterable<readonly [K, V]> | null = []
): Map<K, V> => {
  const map = proxy<InternalProxyMap<K, V>>({
    data:
      entries === null
        ? []
        : Array.from(entries, (v) => ({ key: v[0], value: v[1] })),
    has(key) {
      return this.data.some((p) => p.key === key)
    },
    set(key, value) {
      const record = this.data.find((p) => p.key === key)
      if (record) {
        record.value = value
      } else {
        this.data.push({
          key,
          value,
        })
      }
      return this
    },
    get(key) {
      return this.data.find((p) => p.key === key)?.value
    },
    delete(key) {
      const index = this.data.findIndex((p) => p.key === key)
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
      this.data.forEach(({ key, value }) => {
        cb(value, key, this)
      })
    },
    keys() {
      return this.data.map(({ key }) => key).values()
    },
    values() {
      return this.data.map(({ value }) => value).values()
    },
    entries() {
      const map = new Map<K, V>()
      this.data.forEach(({ key, value }) => {
        map.set(key, value)
      })
      return map.entries()
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

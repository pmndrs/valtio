import { proxy } from 'valtio'

type KeyValRecord<K, V> = {
  key: K
  value: V
}

type InternalProxyMap<K, V> = Map<K, V> & {
  data: KeyValRecord<K, V>[]
  toJSON: object
}

export const proxyMap = <K, V>(
  entries: Iterable<readonly [K, V]> | null = []
): Map<K, V> => {
  const map = proxy<InternalProxyMap<K, V>>({
    data:
      entries === null
        ? []
        : Array.from(entries).map((v) => ({ key: v[0], value: v[1] })),
    has(key) {
      return this.data.findIndex((p) => p.key === key) !== -1
    },
    set(key, value) {
      const idx = this.data.findIndex((p) => p.key === key)
      const payload = {
        key,
        value,
      }
      if (idx !== -1) {
        this.data[idx] = payload
      } else {
        this.data.push(payload)
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
    toJSON: {
      enumerable: false,
    },
  })
  Object.seal(map)

  return map as Map<K, V>
}

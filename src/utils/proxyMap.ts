import { proxy } from 'valtio'

type InternalProxyMap<K, V> = Map<K, V> & {
  data: {
    [key: string]: V
  }
  toJSON: object
  makeMap(): Map<K, V>
}

export const proxyMap = <K, V>(entries?: [K, V][] | null): Map<K, V> => {
  // store user key and dataRef used to access the value provided by the user
  const keyStore = new Map<K, number>()
  let dataRef = 0

  const map: InternalProxyMap<K, V> = proxy({
    data: Object.create(null),
    has(key) {
      // force proxy read so snapshot.has(key) would trigger a rerender
      this.size
      return keyStore.has(key)
    },
    set(key, value) {
      let id: number
      if (keyStore.has(key)) {
        id = keyStore.get(key) as number
      } else {
        dataRef++
        keyStore.set(key, dataRef)
        id = dataRef
      }

      this.data[id] = value

      return this
    },
    get(key) {
      const id = keyStore.get(key)
      if (id) return this.data[id]
    },
    delete(key) {
      const id = keyStore.get(key)
      if (id) {
        keyStore.delete(key)
        return delete this.data[id]
      }
      return false
    },
    clear() {
      keyStore.forEach((id) => {
        delete this.data[id]
      })
      keyStore.clear()
    },
    get size() {
      // trigger the get proxy trap. Allowing us to read the size directly from the map itself
      return keyStore.size
    },
    toJSON() {
      return {}
    },
    forEach(cb) {
      keyStore.forEach((id, key) => {
        cb(this.data[id] as V, key, this)
      })
    },
    keys() {
      return keyStore.keys()
    },
    values() {
      return Object.keys(this.data)
        .map((k) => this.data[k])
        .values() as IterableIterator<V>
    },
    entries() {
      return this.makeMap().entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    [Symbol.iterator]() {
      return this.makeMap()[Symbol.iterator]()
    },
    makeMap() {
      const map = new Map<K, V>()
      keyStore.forEach((v, k) => {
        map.set(k, this.data[v] as V)
      })
      return map
    },
  })

  if (entries) {
    entries.forEach((value) => {
      const [k, v] = value
      map.set(k, v)
    })
  }

  Object.defineProperties(map, {
    data: {
      enumerable: false,
    },
    makeMap: {
      enumerable: false,
    },
    toJSON: {
      enumerable: false,
    },
  })
  Object.seal(map)

  return map as Map<K, V>
}

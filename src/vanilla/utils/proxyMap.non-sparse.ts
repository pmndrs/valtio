import { proxy } from 'valtio'

// let canProxy: (x: unknown) => boolean
// unstable_replaceInternalFunction('canProxy', (prev) => {
//   canProxy = prev
//   return prev
// })

const canProxy = (x: unknown): boolean => {
  const p = proxy({} as { x: unknown })
  p.x = x
  return p.x !== x
}

const maybeProxify = (v: any) => {
  if (canProxy(v)) {
    const pv = proxy(v)
    if (pv !== v) {
      return pv
    }
  }
  return v
}

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<[K, V | undefined]>
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const data: Array<[K, V]> = []
  const indexMap = new Map<K, number>()
  const map = new Map<K, V>()

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new Error(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      map.set(key, value)
      indexMap.set(key, data.length)
      data.push([key, value])
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data,
    get size() {
      return map.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      console.log(k)
      const index = indexMap.get(k)
      console.log('index', index)
      if (index === undefined) {
        return undefined
      }
      console.log('IM', indexMap.get(k))
      if (this.data[index] !== undefined) {
        return this.data[index]![1]
      }
      return undefined
    },
    has(key: K) {
      if (!indexMap.has(key)) {
        this.data.length
      }
      return indexMap.has(key)
    },
    set(key: K, value: V) {
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const index = indexMap.get(k)
      map.set(k, v)
      if (index !== undefined) {
        this.data[index] = [k, v]
      } else {
        indexMap.set(k, this.data.length)
        this.data.push([k, v])
      }
      return this
    },
    delete(key: K) {
      if (map.has(key)) {
        map.delete(key)
        const index = indexMap.get(key)
        this.data.splice(index!, 1)
        indexMap.delete(key)
        return true
      }
      return false
    },
    clear() {
      map.clear()
      indexMap.clear()
      this.data.splice(0)
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      map.forEach((value, key, _map) => {
        cb(value, key, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      for (const [key, value] of map.entries()) {
        yield [key, value]
      }
    },
    *keys(): IterableIterator<K> {
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      for (const value of map.values()) {
        yield value
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return map
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}
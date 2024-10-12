import { proxy, unstable_getInternalStates } from '../../vanilla.ts'
const { proxyStateMap } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<[K, V]>
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<[K, V]> = []
  const indexMap = new Map<K, number>()

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      indexMap.set(key, initialData.length)
      initialData.push([key, value])
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    get size() {
      return indexMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      const index = indexMap.get(k)
      if (index === undefined && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
      }
      if (index !== undefined) {
        return this.data[index]![1]
      }
      return undefined
    },
    has(key: K) {
      const k = maybeProxify(key)
      const exists = indexMap.has(k)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
      }
      return exists
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      return this;
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const index = indexMap.get(k)
      if (index === undefined) {
        indexMap.set(k, this.data.length)
        this.data.push([k, v])
      } else {
        this.data[index]![1] = v
      }
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const index = indexMap.get(k)
      if (index !== undefined) {
        delete this.data[index]
        indexMap.delete(k)
        return true
      }
      return false
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      indexMap.clear()
      this.data.splice(0)
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      indexMap.forEach((index) => {
        cb(this.data[index]![1]!, this.data[index]![0]!, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      for (const index of indexMap.values()) {
        yield this.data[index] as [K, V]
      }
    },
    *keys(): IterableIterator<K> {
      for (const key of indexMap.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      for (const index of indexMap.values()) {
        yield this.data[index]![1]!
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map([...indexMap].map(([k, v]) => [k, this.data[v]![1]!]))
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

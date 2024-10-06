import { getVersion, proxy } from '../../vanilla.ts'

const maybeProxify = (x: any) => proxy({ x }).x

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<[K, V | undefined]>
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const data: Array<[K, V]> = []
  const indexMap = new Map<K, number>()
  const emptyIndexes: number[] = []

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      indexMap.set(key, data.length)
      data.push([key, value])
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data,
    get size() {
      return indexMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      if (indexMap.has(k)) {
        const index = indexMap.get(k)
        if (this.data[index!] !== undefined) {
          return this.data[index!]![1]
        }
      }
      return undefined
    },
    has(key: K) {
      if (!indexMap.has(key)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
      }
      return indexMap.has(key)
    },
    set(key: K, value: V) {
      if (getVersion(this) === undefined) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return this
        }
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      if (indexMap.has(k)) {
        const index = indexMap.get(k)
        this.data[index!] = [k, v]
      } else {
        if (emptyIndexes.length > 0) {
          const index = emptyIndexes.shift()!
          this.data[index] = [k, v]
          indexMap.set(k, index)
        } else {
          // push to this.data first to throw error before accidentally mutating
          // the indexMap when snapshot is used to mutate
          this.data.push([k, v])
          indexMap.set(k, this.data.length - 1)
        }
      }
      return this
    },
    delete(key: K) {
      if (getVersion(this) === undefined) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return false
        }
      }
      if (indexMap.has(key)) {
        const index = indexMap.get(key)
        delete this.data[index!]
        indexMap.delete(key)
        emptyIndexes.push(index!)
        return true
      }
      return false
    },
    clear() {
      if (getVersion(this) === undefined) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return
        }
      }
      indexMap.clear()
      this.data.splice(0)
      emptyIndexes.splice(0)
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
      return new Map(this.data.filter((v) => v !== undefined) as [K, V][])
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

import { proxy, unstable_getInternalStates } from '../../vanilla.ts'
const { proxyStateMap } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)
const CHUNK_SIZE = 1000

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<Array<[K, V] | undefined>>
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const data: Array<Array<[K, V] | undefined>> = []
  const indexMap = new Map<K, { chunkIndex: number; position: number }>()
  const emptyIndexes: { chunkIndex: number; position: number }[] = []

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      let currentChunkIndex = 0
      if (data.length === 0) {
        // create new chunk if none exist
        data.push([])
      } else {
        const lastChunk = data[data.length - 1]!
        if (lastChunk.length === CHUNK_SIZE) {
          // create new chunk if the last chunk is full
          data.push([])
          currentChunkIndex = data.length - 1
        }
      }

      indexMap.set(key, {
        chunkIndex: currentChunkIndex,
        position: data[currentChunkIndex]!.length,
      })
      data[currentChunkIndex]!.push([key, value])
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data,
    get size() {
      return indexMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      if (!indexMap.has(k) && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
      }
      if (indexMap.has(k)) {
        const { chunkIndex, position } = indexMap.get(k)!
        if (this.data[chunkIndex]![position] !== undefined) {
          return this.data[chunkIndex]![position]![1]
        }
      }
      return undefined
    },
    has(key: K) {
      const k = maybeProxify(key)
      if (!indexMap.has(k) && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.data.length
      }
      return indexMap.has(k)
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return this
        }
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const indices = indexMap.get(k)

      if (indices) {
        // Key exists, update the value
        const { chunkIndex, position } = indices
        this.data[chunkIndex]![position]![1] = v
      } else {
        // Key does not exist, insert it
        let chunkIndex: number
        let position: number

        if (emptyIndexes.length > 0) {
          // Reuse an empty position
          const emptyIndex = emptyIndexes.pop()!
          chunkIndex = emptyIndex.chunkIndex
          position = emptyIndex.position
          this.data[chunkIndex]![position] = [k, v]
        } else {
          // No empty positions, add to the last chunk or create a new one
          if (
            this.data.length === 0 ||
            this.data[this.data.length - 1]!.length === CHUNK_SIZE
          ) {
            // Need to create a new chunk
            this.data.push(proxy([]))
          }
          chunkIndex = this.data.length - 1
          position = this.data[chunkIndex]!.length
          this.data[chunkIndex]!.push([k, v])
        }
        // Update the index map with new indices
        indexMap.set(k, { chunkIndex, position })
      }
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return false
        }
      }
      const k = maybeProxify(key)
      if (indexMap.has(k)) {
        const { chunkIndex, position } = indexMap.get(k)!
        delete this.data[chunkIndex]![position]
        emptyIndexes.push({ chunkIndex, position })
        indexMap.delete(k)
        return true
      }
      return false
    },
    clear() {
      if (!isProxy(this)) {
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
      indexMap.forEach(({ chunkIndex, position }) => {
        const item = this.data[chunkIndex]![position]!
        cb(item[1]!, item[0]!, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      for (const { chunkIndex, position } of indexMap.values()) {
        yield this.data[chunkIndex]![position] as [K, V]
      }
    },
    *keys(): IterableIterator<K> {
      for (const key of indexMap.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      for (const { chunkIndex, position } of indexMap.values()) {
        yield this.data[chunkIndex]![position]![1]!
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map(
        [...indexMap].map(([k, { chunkIndex, position }]) => [
          k,
          this.data[chunkIndex]![position]![1]!,
        ]),
      )
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

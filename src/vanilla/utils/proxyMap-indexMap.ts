import { proxy, unstable_getInternalStates } from '../../vanilla.ts'
const { proxyStateMap } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<[K, V | undefined]>
  nextIndex: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<[K, V]> = []
  const indexMap = new Map<K, number>()
  const emptyIndexes: number[] = []
  let initialNextIndex = 0

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
      initialData[initialNextIndex++] = [key, value]
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    nextIndex: initialNextIndex,
    get size() {
      return indexMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      if (!indexMap.has(k) && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.nextIndex
      }
      if (indexMap.has(k)) {
        const index = indexMap.get(k)!
        if (this.data[index] !== undefined) {
          return this.data[index]![1]
        }
      }
      return undefined
    },
    has(key: K) {
      const k = maybeProxify(key)
      if (!indexMap.has(k) && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.nextIndex
      }
      return indexMap.has(k)
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      let index = indexMap.get(k)
      if (index === undefined) {
        index = emptyIndexes.length ? emptyIndexes.pop()! : this.nextIndex++
        indexMap.set(k, index)
      }
      const pair = this.data[index]
      if (pair) {
        pair[1] = v
      } else {
        // Allocate a new array only if necessary
        this.data[index] = [k, v]
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
        const index = indexMap.get(k)!
        delete this.data[index]
        indexMap.delete(k)
        emptyIndexes.push(index)
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
      return new Map([...indexMap].map(([k, v]) => [k, this.data[v]![1]!]))
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    nextIndex: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

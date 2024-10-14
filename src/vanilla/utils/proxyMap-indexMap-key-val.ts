import { proxy, unstable_getInternalStates } from '../../vanilla.ts'
const { proxyStateMap } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxyObject<K, V> = Map<K, V> & {
  dataKeys: Array<K>
  dataValues: Array<V>
  index: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialDataKeys: Array<K> = []
  const initialDataValues: Array<V> = []
  let initialIndex = 0
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
      indexMap.set(key, initialIndex)
      initialDataKeys[initialIndex] = key
      initialDataValues[initialIndex] = value
      initialIndex++
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    dataKeys: initialDataKeys,
    dataValues: initialDataValues,
    index: initialIndex,
    get size() {
      return indexMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      const index = indexMap.get(k)
      if (index === undefined && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.index
      }
      if (index !== undefined) {
        return this.dataValues[index]
      }
      return undefined
    },
    has(key: K) {
      const k = maybeProxify(key)
      const exists = indexMap.has(k)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.index
      }
      return exists
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const index = indexMap.get(k)
      if (index === undefined) {
        indexMap.set(k, this.index)
        this.dataKeys[this.index] = k
        this.dataValues[this.index] = v
        this.index++
      } else {
        this.dataValues[index] = v
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
        delete this.dataKeys[index]
        delete this.dataValues[index]
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
      this.dataKeys.splice(0)
      this.dataValues.splice(0)
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      indexMap.forEach((index) => {
        cb(this.dataValues[index]!, this.dataKeys[index]!, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      for (const index of indexMap.values()) {
        yield [this.dataKeys[index], this.dataValues[index]] as [K, V]
      }
    },
    *keys(): IterableIterator<K> {
      for (const key of indexMap.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      for (const index of indexMap.values()) {
        yield this.dataValues[index]!
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map([...indexMap].map(([k, v]) => [k, this.dataValues[v]!]))
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

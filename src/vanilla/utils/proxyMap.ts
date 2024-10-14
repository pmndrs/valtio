import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap, snapCache } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<K | V>
  index: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialData: Array<K | V> = []
  let initialIndex = 0
  const indexMap = new Map<K, number>()
  const snapMapCache = new WeakMap<object, Map<K, number>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapMapCache.has(latestSnap)) {
      const clonedMap = new Map(indexMap)
      // TODO: should we support snapshot keys?
      // for (const [k, i] of indexMap) {
      //   if (isProxy(k)) {
      //     clonedMap.set(snapshot(k as object) as K, i)
      //   }
      // }
      snapMapCache.set(latestSnap, clonedMap)
      return true
    }
    return false
  }
  const getSnapMap = (x: any) => snapMapCache.get(x)

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
      initialData[initialIndex++] = key
      initialData[initialIndex++] = value
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: initialData,
    index: initialIndex,
    get size() {
      if (!isProxy(this)) {
        registerSnapMap()
      }
      const map = getSnapMap(this) || indexMap
      return map.size
    },
    get(key: K) {
      const map = getSnapMap(this) || indexMap
      const k = maybeProxify(key)
      const index = map.get(k)
      if (index === undefined) {
        if (!isProxy(this)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.index
        }
        return undefined
      }
      return this.data[index + 1] as V
    },
    has(key: K) {
      const map = getSnapMap(this) || indexMap
      const k = maybeProxify(key)
      const exists = map.has(k)
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
      if (index !== undefined) {
        this.data[index + 1] = v
      } else {
        let nextIndex = this.index
        indexMap.set(k, nextIndex)
        this.data[nextIndex++] = k
        this.data[nextIndex++] = v
        this.index = nextIndex
      }

      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const index = indexMap.get(k)
      if (index === undefined) {
        return false
      }

      delete this.data[index]
      delete this.data[index + 1]
      indexMap.delete(k)
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      indexMap.clear()
      this.index = 0
      this.data.length = 0
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      const map = getSnapMap(this) || indexMap
      map.forEach((index) => {
        cb(this.data[index + 1] as V, this.data[index] as K, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      const map = getSnapMap(this) || indexMap
      for (const index of map.values()) {
        yield [this.data[index], this.data[index + 1]] as [K, V]
      }
    },
    *keys(): IterableIterator<K> {
      const map = getSnapMap(this) || indexMap
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      const map = getSnapMap(this) || indexMap
      for (const index of map.values()) {
        yield this.data[index + 1] as V
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      const map = getSnapMap(this) || indexMap
      return new Map([...map].map(([k, i]) => [k, this.data[i + 1] as V]))
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    index: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

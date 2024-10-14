import {
  proxy,
  snapshot,
  subscribe,
  unstable_getInternalStates,
} from '../../vanilla.ts'

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
  const unsubKeyMap = new Map<object, () => void>()
  const unsubValMap = new Map<object, () => void>()
  const snapMapCache = new WeakMap<object, Map<K, V>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapMapCache.has(latestSnap)) {
      const snapMap = new Map<K, V>()
      for (let i = 0; i < vObject.data.length; i += 2) {
        const k = vObject.data[i] as K
        const v = vObject.data[i + 1] as V
        snapMap.set(
          isProxy(k) ? (snapshot(k as object) as K) : k,
          isProxy(v) ? (snapshot(v as object) as V) : v,
        )
      }
      snapMapCache.set(latestSnap, snapMap)
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
      registerSnapMap()
      const map = getSnapMap(this) || indexMap
      return map.size
    },
    get(key: K) {
      const map = getSnapMap(this) || indexMap
      const k = maybeProxify(key)
      if (!map.has(k)) {
        if (!isProxy(this)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.index
        }
        return undefined
      }

      if (map === indexMap) {
        const index = indexMap.get(k)
        return index ? (this.data[index + 1] as V) : undefined
      }

      return map.get(k) as V
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
        const val = this.data[index + 1]
        if (!Object.is(val, v)) {
          unsubValMap.get(val as object)?.()
          unsubValMap.delete(val as object)
          if (isProxy(v)) {
            unsubValMap.set(
              v,
              subscribe(v, () => void this.index++, true),
            )
          }
          this.data[index + 1] = v
        }
        return this
      }
      if (isProxy(k)) {
        unsubKeyMap.set(
          k,
          subscribe(k, () => void this.index++, true),
        )
      }
      if (isProxy(v)) {
        unsubValMap.set(
          v,
          subscribe(v, () => void this.index++, true),
        )
      }

      let nextIndex = this.index
      indexMap.set(k, nextIndex)
      this.data[nextIndex++] = k
      this.data[nextIndex++] = v
      this.index = nextIndex

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
      unsubKeyMap.get(k)?.()
      unsubKeyMap.delete(k)

      const val = this.data[index + 1]
      unsubValMap.get(val as object)?.()
      unsubValMap.delete(val as object)

      delete this.data[index]
      delete this.data[index + 1]
      indexMap.delete(k)
      return true
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }

      for (const unsub of unsubKeyMap.values()) {
        unsub()
      }
      unsubKeyMap.clear()

      for (const unsub of unsubValMap.values()) {
        unsub()
      }
      unsubValMap.clear()

      indexMap.clear()
      this.index = 0
      this.data.splice(0)
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      const map = getSnapMap(this) || indexMap
      if (map === indexMap) {
        indexMap.forEach((index) => {
          cb(this.data[index + 1] as V, this.data[index] as K, this)
        })
      } else {
        return (map as Map<K, V>).forEach(cb)
      }
    },
    *entries(): MapIterator<[K, V]> {
      const map = getSnapMap(this) || indexMap
      if (map === indexMap) {
        for (const index of indexMap.values()) {
          yield [this.data[index], this.data[index + 1]] as [K, V]
        }
      } else {
        for (const [k, v] of map) {
          yield [k, v as V]
        }
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
      if (map === indexMap) {
        for (const index of indexMap.values()) {
          yield this.data[index + 1] as V
        }
      } else {
        for (const v of map.values()) {
          yield v as V
        }
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
      if (map === indexMap) {
        return new Map(
          [...indexMap].map(([k, i]) => [k, this.data[i + 1] as V]),
        )
      }
      return new Map(map as Map<K, V>)
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    index: { enumerable: false },
    data: { enumerable: false },
    index: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

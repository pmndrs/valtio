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
  epoch: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>() {
  const rawMap = new Map<K, V>()
  const unsubKeyMap = new WeakMap<object, () => void>()
  const unsubValMap = new WeakMap<object, () => void>()

  const snapMapCache = new WeakMap<object, Map<K, V>>()
  const registerSnapMap = () => {
    const cache = snapCache.get(vObject)
    const latestSnap = cache?.[1]
    if (latestSnap && !snapMapCache.has(latestSnap)) {
      const snapMap = new Map<K, V>()
      for (const [k, v] of rawMap) {
        snapMap.set(
          isProxy(k) ? (snapshot(k as object) as K) : k,
          isProxy(v) ? (snapshot(v as object) as V) : v,
        )
      }
      snapMapCache.set(latestSnap, snapMap)
    }
  }
  const getSnapMap = (x: any) => snapMapCache.get(x)

  const vObject: InternalProxyObject<K, V> = {
    epoch: 0,
    get size() {
      registerSnapMap()
      const map = getSnapMap(this) || rawMap
      return map.size
    },
    get(key: K) {
      const map = getSnapMap(this) || rawMap
      const k = maybeProxify(key)
      if (!map.has(k)) {
        if (!isProxy(this)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.epoch
        }
        return undefined
      }
      const val = map.get(k) as V
      if (isProxy(this)) {
        return val
      }
      if (isProxy(val)) {
        return snapshot(val as object) as V
      }
      return val
    },
    has(key: K) {
      const map = getSnapMap(this) || rawMap
      const k = maybeProxify(key)
      const exists = map.has(k)
      if (!exists && !isProxy(this)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.epoch
      }
      return exists
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      if (rawMap.has(k)) {
        const val = rawMap.get(k) as V
        if (!Object.is(val, v)) {
          unsubValMap.get(val as object)?.()
          unsubValMap.delete(val as object)
          if (isProxy(v)) {
            unsubValMap.set(
              v,
              subscribe(v, () => void this.epoch++, true),
            )
          }
          this.epoch++
          rawMap.set(k, v)
        }
        return this
      }
      if (isProxy(k)) {
        unsubKeyMap.set(
          k,
          subscribe(k, () => void this.epoch++, true),
        )
      }
      if (isProxy(v)) {
        unsubValMap.set(
          v,
          subscribe(v, () => void this.epoch++, true),
        )
      }
      this.epoch++
      rawMap.set(k, v)
      return this
    },
    delete(_key: K) {
      throw new Error('Not implemented')
    },
    clear() {
      throw new Error('Not implemented')
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      const map = getSnapMap(this) || rawMap
      map.forEach(cb)
    },
    *entries(): MapIterator<[K, V]> {
      const map = getSnapMap(this) || rawMap
      for (const [k, v] of map) {
        yield [k, v]
      }
    },
    *keys(): IterableIterator<K> {
      const map = getSnapMap(this) || rawMap
      for (const k of map.keys()) {
        yield k
      }
    },
    *values(): IterableIterator<V> {
      const map = getSnapMap(this) || rawMap
      for (const v of map.values()) {
        yield v
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      const map = getSnapMap(this) || rawMap
      return map
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    epoch: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

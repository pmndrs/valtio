import {
  proxy,
  snapshot,
  subscribe,
  unstable_getInternalStates,
} from '../../vanilla.ts'

const { proxyStateMap } = unstable_getInternalStates()
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

  const vObject: InternalProxyObject<K, V> = {
    epoch: 0,
    get size() {
      return rawMap.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      if (!rawMap.has(k)) {
        if (!isProxy(this)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          this.epoch
        }
        return undefined
      }
      const val = rawMap.get(k) as V
      if (isProxy(this)) {
        return val
      }
      if (isProxy(val)) {
        return snapshot(val as object) as V
      }
      return val
    },
    has(key: K) {
      const k = maybeProxify(key)
      const exists = rawMap.has(k)
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
    delete(key: K) {
      throw new Error('Not implemented')
    },
    clear() {
      throw new Error('Not implemented')
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      //indexMap.forEach((index) => {
      //  cb(this.data[index + 1] as V, this.data[index] as K, this)
      //})
    },
    *entries(): MapIterator<[K, V]> {
      //for (const index of indexMap.values()) {
      //  yield [this.data[index], this.data[index + 1]] as [K, V]
      //}
    },
    *keys(): IterableIterator<K> {
      //for (const key of indexMap.keys()) {
      //  yield key
      //}
    },
    *values(): IterableIterator<V> {
      //for (const index of indexMap.values()) {
      //  yield this.data[index + 1] as V
      //}
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      throw new Error('Not implemented')
      // return new Map([...indexMap].map(([k, i]) => [k, this.data[i + 1] as V]))
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

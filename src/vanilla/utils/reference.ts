/* eslint-disable */
// @ts-nocheck
// prettier-ignore


import { proxy, subscribe, snapshot } from 'valtio'

function createTrackedMap<K extends object | Primitive, V>(initialEntries?: Iterable<[K, V]>) {
  type Primitive = string | number | symbol | boolean | null | undefined

  const map = new Map<K, V>() // Internal map using proxied keys

  // Map from original keys to proxied keys
  const keyToProxyMap = new WeakMap<object, object>()
  const proxyToKeyMap = new WeakMap<object, object>()

  // Map for primitive keys (no need to proxy primitives)
  const primitiveKeySet = new Set<Primitive>()

  // Map from proxied keys to proxied values
  const valueProxyMap = new WeakMap<object, any>()
  const primitiveValueProxyMap = new Map<Primitive, any>()

  // Helper function to get or create a proxied key
  const getProxiedKey = (key: K): K => {
    if (typeof key === 'object' && key !== null) {
      if (!keyToProxyMap.has(key)) {
        const proxiedKey = proxy(key)
        keyToProxyMap.set(key, proxiedKey)
        proxyToKeyMap.set(proxiedKey, key)
        return proxiedKey as K
      }
      return keyToProxyMap.get(key) as K
    } else {
      // For primitives, no proxying needed
      primitiveKeySet.add(key as Primitive)
      return key
    }
  }

  const proxiedMap = new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        return function (key: K) {
          const proxiedKey = getProxiedKey(key)
          const value = target.get(proxiedKey)

          let proxiedValue
          if (typeof proxiedKey === 'object' && proxiedKey !== null) {
            if (!valueProxyMap.has(proxiedKey)) {
              valueProxyMap.set(proxiedKey, proxy({ value }))
            }
            proxiedValue = valueProxyMap.get(proxiedKey).value
          } else {
            if (!primitiveValueProxyMap.has(proxiedKey as Primitive)) {
              primitiveValueProxyMap.set(proxiedKey as Primitive, proxy({ value }))
            }
            proxiedValue = primitiveValueProxyMap.get(proxiedKey as Primitive).value
          }
          return proxiedValue
        }
      }

      if (prop === 'set') {
        return function (key: K, value: V) {
          const proxiedKey = getProxiedKey(key)

          let proxiedValue
          if (typeof proxiedKey === 'object' && proxiedKey !== null) {
            proxiedValue = proxy({ value })
            valueProxyMap.set(proxiedKey, proxiedValue)
          } else {
            proxiedValue = proxy({ value })
            primitiveValueProxyMap.set(proxiedKey as Primitive, proxiedValue)
          }

          target.set(proxiedKey, value)
          return receiver
        }
      }

      if (prop === 'delete') {
        return function (key: K) {
          const proxiedKey = getProxiedKey(key)

          if (typeof proxiedKey === 'object' && proxiedKey !== null) {
            valueProxyMap.delete(proxiedKey)
            keyToProxyMap.delete(key as object)
            proxyToKeyMap.delete(proxiedKey)
          } else {
            primitiveValueProxyMap.delete(proxiedKey as Primitive)
            primitiveKeySet.delete(proxiedKey as Primitive)
          }
          return target.delete(proxiedKey)
        }
      }

      if (prop === 'has') {
        return function (key: K) {
          const proxiedKey = getProxiedKey(key)
          return target.has(proxiedKey)
        }
      }

      if (prop === 'clear') {
        return function () {
          valueProxyMap = new WeakMap()
          primitiveValueProxyMap.clear()
          keyToProxyMap = new WeakMap()
          proxyToKeyMap = new WeakMap()
          primitiveKeySet.clear()
          return target.clear()
        }
      }

      if (prop === Symbol.iterator || prop === 'entries') {
        return function* () {
          for (let [proxiedKey, value] of target) {
            let originalKey: K
            if (typeof proxiedKey === 'object' && proxiedKey !== null) {
              originalKey = proxyToKeyMap.get(proxiedKey) as K
            } else {
              originalKey = proxiedKey
            }
            yield [originalKey, value]
          }
        }
      }

      if (prop === 'keys') {
        return function* () {
          for (let proxiedKey of target.keys()) {
            let originalKey: K
            if (typeof proxiedKey === 'object' && proxiedKey !== null) {
              originalKey = proxyToKeyMap.get(proxiedKey) as K
            } else {
              originalKey = proxiedKey
            }
            yield originalKey
          }
        }
      }

      if (prop === 'values') {
        return function* () {
          for (let value of target.values()) {
            yield value
          }
        }
      }

      if (prop === 'size') {
        return target.size
      }

      // For other methods, bind them to the receiver
      const propValue = target[prop as keyof Map<K, V>]
      if (typeof propValue === 'function') {
        return propValue.bind(receiver)
      }
      return propValue
    },
  })

  // Initialize with initial entries
  if (initialEntries) {
    for (let [key, value] of initialEntries) {
      proxiedMap.set(key, value)
    }
  }

  return proxiedMap
}

/* eslint-disable */
// @ts-nocheck
// prettier-ignore

import { proxy } from 'valtio'

// Even though symbol is a primitive, we are omitting it here because symbol is a valid key for WeakMap and WeakSet
type Primitive = string | number | boolean | null | undefined | bigint

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

const canProxy = (x: unknown) =>
  isObject(x) &&
  (Array.isArray(x) || !(Symbol.iterator in x)) &&
  !(x instanceof WeakMap) &&
  !(x instanceof WeakSet) &&
  !(x instanceof Error) &&
  !(x instanceof Number) &&
  !(x instanceof Date) &&
  !(x instanceof String) &&
  !(x instanceof RegExp) &&
  !(x instanceof ArrayBuffer) &&
  !(x instanceof Promise)

const maybeProxify = (v: any) => (canProxy(v) ? proxy(v) : v)

const proxyMap = <K extends PrimitiveKey | object, V>(entries?: Iterable<[K, V]> | null) => {
  type PrimitiveObject = {
    value: Primitive
  }
  type PrimitiveObjectMeta = {
    version: number,
    accessed: number
  }
  const proxifyObjects = new WeakMap<PrimitiveObject, PrimitiveObjectMeta>()

  //
  const Symbol_identity = Symbol('identity')

  const makeProxyable = (v: any) => {

    if (!isObject(v)) {
      const obj = {
        [Symbol_objectifyValue]: v,
        [Symbol.toPrimitive]: (hint) => {
          if (hint === 'number') {
            return +v[Symbol_objectifyValue]
          }
          if (hint === 'string') {
            return `${v[Symbol_objectifyValue]}`
          }
          return v[Symbol_objectifyValue]
        },
      }
      proxifyObjects.add(obj, {
        version: 1,
        accessed: 0
      })
      return obj
    }
    return v
  }
  const getValue = (v: any) => {
    if (proxifyObjects.has(v)) {
      proxifyObjects.get(v).accessed++
      return v[Symbol_objectifyValue]
    }
    return v
  }

  const map = new Map<any, any>() // Internal map using proxied keys and values (where possible)

  // Map from origin keys to proxied keys so we keep original references
  const keyToProxyMap = new WeakMap<object | symbol, object>()
  const proxyToKeyMap = new WeakMap<object | symbol, object>()

  // Set for primitive keys (no need to proxy primitives)
  const primitiveKeySet = new Set()

  // Map from proxied keys to proxied values
  const valueProxyMap = new WeakMap()
  const primitiveValueProxyMap = new Map()

  // Helper function to get or create a proxied key
  const getProxiedKey = (key: K): K => {
    if (typeof key === 'object' && key !== null) {
      if (!keyToProxyMap.has(key)) {
        const proxiedKey = maybeProxify(key)
        keyToProxyMap.set(key, proxiedKey)
        proxyToKeyMap.set(proxiedKey, key)
        return proxiedKey as K
      }
      return keyToProxyMap.get(key) as K
    } else {
      // For primitives, no proxying needed
      primitiveKeySet.add(key as PrimitiveKey)
      return key
    }
  }

  const mapProxy = new Proxy(map, {
    get(target, prop, receiver) {
      switch (prop) {
        case 'get':
          return (key: K) => {
            const proxiedKey = getProxiedKey(key)
            const value = target.get(proxiedKey)

            if (canProxy(proxiedKey)) {
              if (!valueProxyMap.has(proxiedKey)) {
                valueProxyMap.set(proxiedKey, proxy(value))
              }

            }

            if (typeof proxiedKey === 'object' && proxiedKey !== null) {
              if (!valueProxyMap.has(proxiedKey)) {
                valueProxyMap.set(proxiedKey, proxy( value ))
              }
              return valueProxyMap.get(proxiedKey).value
            }

            if (!primitiveValueProxyMap.has(proxiedKey)) {
              primitiveValueProxyMap.set(proxiedKey, proxy(value))
            }
          }
        case 'set':

        case 'delete':

        case 'has':

        case 'clear':

        case 'keys':

        case 'values':

        case 'size':

        case 'forEach':

        case 'entries':

        case Symbol.toStringTag:

        case Symbol.iterator:

        default:
      }
    }
  })
}

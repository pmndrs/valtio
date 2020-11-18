import { useMemo, useRef, useEffect } from 'react'

import {
  createDeepProxy,
  isDeepChanged,
  getUntrackedObject,
} from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'

const MUTABLE_SOURCE = Symbol()
const LISTENERS = Symbol()
const SNAPSHOT = Symbol()

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

let globalVersion = 0
const snapshotCache = new WeakMap<
  object,
  {
    version: number
    snapshot: unknown
  }
>()

const createProxy = <T extends object>(initialObject: T = {} as T): T => {
  let version = globalVersion
  let mutableSource: any
  const listeners = new Set<(nextVersion?: number) => void>()
  const notifyUpdate = (nextVersion?: number) => {
    if (!nextVersion) {
      nextVersion = ++globalVersion
    }
    if (version !== nextVersion) {
      version = nextVersion
      listeners.forEach((listener) => listener(nextVersion))
    }
  }
  const proxy = new Proxy(Object.create(initialObject.constructor.prototype), {
    get(target, prop, receiver) {
      if (prop === MUTABLE_SOURCE) {
        if (!mutableSource) {
          mutableSource = createMutableSource(receiver, () => version)
        }
        return mutableSource
      }
      if (prop === LISTENERS) {
        return listeners
      }
      if (prop === SNAPSHOT) {
        const cache = snapshotCache.get(receiver)
        if (cache && cache.version === version) {
          return cache.snapshot
        }
        const snapshot = Object.create(target.constructor.prototype)
        snapshotCache.set(receiver, { version, snapshot })
        Reflect.ownKeys(target).forEach((key) => {
          const value = target[key]
          if (!isObject(value)) {
            snapshot[key] = value
          } else if (value instanceof Promise) {
            Object.defineProperty(snapshot, key, {
              get() {
                throw value
              },
            })
          } else {
            snapshot[key] = (value as any)[SNAPSHOT]
          }
        })
        return snapshot
      }
      return target[prop]
    },
    deleteProperty(target, prop) {
      const value = target[prop]
      const childListeners = isObject(value) && (value as any)[LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      delete target[prop]
      notifyUpdate()
      return true
    },
    set(target, prop, value, receiver) {
      const childListeners = isObject(target[prop]) && target[prop][LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      if (!isObject(value)) {
        target[prop] = value
      } else if (value instanceof Promise) {
        target[prop] = value.then((v) => {
          receiver[prop] = v
        })
      } else {
        value = getUntrackedObject(value) ?? value
        if (value[LISTENERS]) {
          target[prop] = value
        } else {
          target[prop] = createProxy(value)
        }
        target[prop][LISTENERS].add(notifyUpdate)
      }
      notifyUpdate()
      return true
    },
  })
  Reflect.ownKeys(initialObject).forEach((key) => {
    proxy[key] = (initialObject as any)[key]
  })
  return proxy
}

const subscribe = (proxy: any, callback: () => void) => {
  proxy[LISTENERS].add(callback)
  return () => {
    proxy[LISTENERS].delete(callback)
  }
}

const useProxy = <T extends object>(proxy: T): T => {
  const affected = new WeakMap()
  const lastAffected = useRef<WeakMap<object, unknown>>()
  useEffect(() => {
    lastAffected.current = affected
  })
  const getSnapshot = useMemo(() => {
    let prevSnapshot: any = null
    const deepChangedCache = new WeakMap()
    return (proxy: any) => {
      const snapshot = proxy[SNAPSHOT]
      try {
        if (
          prevSnapshot !== null &&
          lastAffected.current &&
          !isDeepChanged(
            prevSnapshot,
            snapshot,
            lastAffected.current,
            deepChangedCache
          )
        ) {
          // not changed
          return prevSnapshot
        }
      } catch (e) {
        // ignore and return new snapshot
      }
      return (prevSnapshot = snapshot)
    }
  }, [])
  const snapshot = useMutableSource(
    (proxy as any)[MUTABLE_SOURCE],
    getSnapshot,
    subscribe
  )
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(snapshot, affected, proxyCache)
}

export { createProxy as proxy, useProxy, subscribe }

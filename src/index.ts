import { useMemo, useRef, useEffect } from 'react'

import {
  createDeepProxy,
  isDeepChanged,
  getUntrackedObject,
} from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'

const MUTABLE_SOURCE = Symbol()
const LISTNERS = Symbol()
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
  const listners = new Set<(nextVersion?: number) => void>()
  const notifyUpdate = (nextVersion?: number) => {
    if (!nextVersion) {
      nextVersion = ++globalVersion
    }
    if (version !== nextVersion) {
      version = nextVersion
      listners.forEach((listener) => listener(nextVersion))
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
      if (prop === LISTNERS) {
        return listners
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
          if (isObject(value)) {
            snapshot[key] = (value as any)[SNAPSHOT]
          } else {
            snapshot[key] = value
          }
        })
        return snapshot
      }
      return target[prop]
    },
    deleteProperty(target, prop) {
      const value = target[prop]
      if (isObject(value)) {
        ;(value as any)[LISTNERS].delete(notifyUpdate)
      }
      delete target[prop]
      notifyUpdate()
      return true
    },
    set(target, prop, value) {
      if (isObject(target[prop])) {
        target[prop][LISTNERS].delete(notifyUpdate)
      }
      if (isObject(value)) {
        value = getUntrackedObject(value) ?? value
        if (value[LISTNERS]) {
          target[prop] = value
        } else {
          target[prop] = createProxy(value)
        }
        target[prop][LISTNERS].add(notifyUpdate)
      } else {
        target[prop] = value
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
  proxy[LISTNERS].add(callback)
  return () => {
    proxy[LISTNERS].delete(callback)
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
      prevSnapshot = snapshot
      return snapshot
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

export { createProxy as proxy, useProxy }

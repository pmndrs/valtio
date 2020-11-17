import { useMemo, useRef, useEffect } from 'react'

import { createDeepProxy, isDeepChanged } from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'

const MUTABLE_SOURCE = Symbol()
const LISTNERS = Symbol()
const SNAPSHOT = Symbol()

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

export const create = <T extends object>(initialObject?: T): T => {
  let version = 0
  let snapshotVersion = -1
  let savedSnapshot: any
  let mutableSource: any
  const incrementVersion = () => ++version
  const listners = new Set<() => void>()
  const proxy = new Proxy({} as any, {
    get(target, prop) {
      if (prop === MUTABLE_SOURCE) {
        if (!mutableSource) {
          mutableSource = createMutableSource(proxy, () => version)
        }
        return mutableSource
      }
      if (prop === LISTNERS) {
        return listners
      }
      if (prop === SNAPSHOT) {
        if (version === snapshotVersion) {
          return savedSnapshot
        }
        const snapshot = {} as any
        Reflect.ownKeys(target).forEach((key) => {
          const value = target[key]
          if (isObject(value)) {
            snapshot[key] = (value as any)[SNAPSHOT]
          } else {
            snapshot[key] = value
          }
        })
        savedSnapshot = snapshot
        snapshotVersion = version
        return snapshot
      }
      return target[prop]
    },
    deleteProperty(target, prop) {
      const value = target[prop]
      if (isObject(value)) {
        ;(value as any)[LISTNERS].delete(incrementVersion)
      }
      delete target[prop]
      incrementVersion()
      listners.forEach((listener) => listener())
      return true
    },
    set(target, prop, value) {
      if (isObject(target[prop])) {
        target[prop][LISTNERS].delete(incrementVersion)
      }
      if (isObject(value)) {
        target[prop] = create()
        Reflect.ownKeys(value).forEach((key) => {
          target[prop][key] = (value as any)[key]
        })
        target[prop][LISTNERS].add(incrementVersion)
      } else {
        target[prop] = value
      }
      incrementVersion()
      listners.forEach((listener) => listener())
      return true
    },
  })
  if (initialObject) {
    Reflect.ownKeys(initialObject).forEach((key) => {
      proxy[key] = (initialObject as any)[key]
    })
  }
  return proxy
}

const subscribe = (proxy: any, callback: () => void) => {
  proxy[LISTNERS].add(callback)
  return () => {
    proxy[LISTNERS].delete(callback)
  }
}

export const useProxy = (proxy: any) => {
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
    proxy[MUTABLE_SOURCE],
    getSnapshot,
    subscribe
  )
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(snapshot, affected, proxyCache)
}

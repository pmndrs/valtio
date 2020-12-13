import { useCallback, useMemo, useRef, useEffect } from 'react'
import { createDeepProxy, isDeepChanged } from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'
import { proxy, getVersion, subscribe, snapshot, NonPromise } from './vanilla'

type MutableSource = any
const mutableSourceCache = new WeakMap<object, MutableSource>()
const getMutableSource = (p: any): MutableSource => {
  if (!mutableSourceCache.has(p)) {
    mutableSourceCache.set(p, createMutableSource(p, getVersion))
  }
  return mutableSourceCache.get(p) as MutableSource
}

type Options = {
  sync?: boolean
}

const useProxy = <T extends object>(p: T, options?: Options): NonPromise<T> => {
  const affected = new WeakMap()
  const lastAffected = useRef<WeakMap<object, unknown>>()
  useEffect(() => {
    lastAffected.current = affected
  })
  const getSnapshot = useMemo(() => {
    let prevSnapshot: any = null
    const deepChangedCache = new WeakMap()
    return (p: any) => {
      const nextSnapshot = snapshot(p)
      try {
        if (
          prevSnapshot !== null &&
          lastAffected.current &&
          !isDeepChanged(
            prevSnapshot,
            nextSnapshot,
            lastAffected.current,
            deepChangedCache
          )
        ) {
          // not changed
          return prevSnapshot
        }
      } catch (e) {
        // ignore and return new nextSnapshot
      }
      return (prevSnapshot = nextSnapshot)
    }
  }, [])
  const notifyInSync = options?.sync
  const sub = useCallback(
    (p: any, cb: () => void) => subscribe(p, cb, notifyInSync),
    [notifyInSync]
  )
  const currSnapshot = useMutableSource(getMutableSource(p), getSnapshot, sub)
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(currSnapshot, affected, proxyCache)
}

export { proxy, subscribe, snapshot, useProxy }

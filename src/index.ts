import { useMemo, useRef, useEffect } from 'react'

import { createDeepProxy, isDeepChanged } from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'

import { proxy, getMutableSource, subscribe, getSnapshot } from './vanilla'

const useProxy = <T extends object>(p: T): T => {
  const affected = new WeakMap()
  const lastAffected = useRef<WeakMap<object, unknown>>()
  useEffect(() => {
    lastAffected.current = affected
  })
  const getChangedSnapshot = useMemo(() => {
    let prevSnapshot: any = null
    const deepChangedCache = new WeakMap()
    return (p: any) => {
      const snapshot = getSnapshot(p)
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
    getMutableSource(p, createMutableSource),
    getChangedSnapshot,
    subscribe
  )
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(snapshot, affected, proxyCache)
}

export { proxy, subscribe, getSnapshot, useProxy }

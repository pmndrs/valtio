import { useMemo, useRef, useEffect } from 'react'

import { createDeepProxy, isDeepChanged } from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'

import { proxy, getMutableSource, subscribe, snapshot } from './vanilla'

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
  const currSnapshot = useMutableSource(
    getMutableSource(p, createMutableSource),
    getChangedSnapshot,
    subscribe
  )
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(currSnapshot, affected, proxyCache)
}

export { proxy, subscribe, snapshot, useProxy }

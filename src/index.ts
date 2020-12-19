import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { createDeepProxy, isDeepChanged } from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'
import { proxy, getVersion, subscribe, snapshot, NonPromise } from './vanilla'

const isSSR =
  typeof window === 'undefined' ||
  /ServerSideRendering/.test(window.navigator && window.navigator.userAgent)

const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect

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
  const [, forceUpdate] = useReducer((c) => c + 1, 0)
  const affected = new WeakMap()
  const lastAffected = useRef<typeof affected>()
  const prevSnapshot = useRef<NonPromise<T>>()
  const lastSnapshot = useRef<NonPromise<T>>()
  useIsomorphicLayoutEffect(() => {
    lastAffected.current = affected
    if (
      prevSnapshot.current !== lastSnapshot.current &&
      isDeepChanged(
        prevSnapshot.current,
        lastSnapshot.current,
        affected,
        new WeakMap()
      )
    ) {
      prevSnapshot.current = lastSnapshot.current
      forceUpdate()
    }
  })
  const getSnapshot = useMemo(() => {
    const deepChangedCache = new WeakMap()
    return (p: T) => {
      const nextSnapshot = snapshot(p)
      lastSnapshot.current = nextSnapshot
      try {
        if (
          prevSnapshot &&
          lastAffected.current &&
          !isDeepChanged(
            prevSnapshot.current,
            nextSnapshot,
            lastAffected.current,
            deepChangedCache
          )
        ) {
          // not changed
          return prevSnapshot.current
        }
      } catch (e) {
        // ignore and return nextSnapshot
      }
      return (prevSnapshot.current = nextSnapshot)
    }
  }, [])
  const notifyInSync = options?.sync
  const sub = useCallback(
    (p: T, cb: () => void) => subscribe(p, cb, notifyInSync),
    [notifyInSync]
  )
  const currSnapshot = useMutableSource(getMutableSource(p), getSnapshot, sub)
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(currSnapshot, affected, proxyCache)
}

export { proxy, subscribe, snapshot, useProxy }

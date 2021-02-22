import {
  useCallback,
  useDebugValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import {
  createDeepProxy,
  isDeepChanged,
  affectedToPathList,
} from 'proxy-compare'

import { createMutableSource, useMutableSource } from './useMutableSource'
import {
  proxy,
  getVersion,
  subscribe,
  snapshot,
  ref,
  NonPromise,
} from './vanilla'

const isSSR =
  typeof window === 'undefined' ||
  /ServerSideRendering/.test(window.navigator && window.navigator.userAgent)

const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect

const useAffectedDebugValue = <State>(
  state: State,
  affected: WeakMap<object, unknown>
) => {
  const pathList = useRef<(string | number | symbol)[][]>()
  useEffect(() => {
    pathList.current = affectedToPathList(state, affected)
  })
  useDebugValue(pathList.current)
}

type MutableSource = any
const mutableSourceCache = new WeakMap<object, MutableSource>()
const getMutableSource = (proxyObject: any): MutableSource => {
  if (!mutableSourceCache.has(proxyObject)) {
    mutableSourceCache.set(
      proxyObject,
      createMutableSource(proxyObject, getVersion)
    )
  }
  return mutableSourceCache.get(proxyObject) as MutableSource
}

type Options = {
  sync?: boolean
}

const useProxy = <T extends object>(
  proxyObject: T,
  options?: Options
): NonPromise<T> => {
  const [, forceUpdate] = useReducer((c) => c + 1, 0)
  const affected = new WeakMap()
  const lastAffected = useRef<typeof affected>()
  const prevSnapshot = useRef<NonPromise<T>>()
  const lastSnapshot = useRef<NonPromise<T>>()
  useIsomorphicLayoutEffect(() => {
    lastSnapshot.current = prevSnapshot.current = snapshot(proxyObject)
  }, [proxyObject])
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
  const notifyInSync = options?.sync
  const sub = useCallback(
    (proxyObject: T, cb: () => void) =>
      subscribe(
        proxyObject,
        () => {
          const nextSnapshot = snapshot(proxyObject)
          lastSnapshot.current = nextSnapshot
          try {
            if (
              lastAffected.current &&
              !isDeepChanged(
                prevSnapshot.current,
                nextSnapshot,
                lastAffected.current,
                new WeakMap()
              )
            ) {
              // not changed
              return
            }
          } catch (e) {
            // ignore if a promise or something is thrown
          }
          prevSnapshot.current = nextSnapshot
          cb()
        },
        notifyInSync
      ),
    [notifyInSync]
  )
  const currSnapshot = useMutableSource(
    getMutableSource(proxyObject),
    snapshot,
    sub
  )
  if (typeof process === 'object' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAffectedDebugValue(currSnapshot, affected)
  }
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createDeepProxy(currSnapshot, affected, proxyCache)
}

export { proxy, subscribe, snapshot, ref, useProxy }

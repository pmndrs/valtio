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

import { getVersion, subscribe, snapshot } from './vanilla'
import { createMutableSource, useMutableSource } from './useMutableSource'
import type { DeepResolveType } from './vanilla'

const isSSR =
  typeof window === 'undefined' ||
  !window.navigator ||
  /ServerSideRendering|^Deno\//.test(window.navigator.userAgent)

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

/**
 * useSnapshot
 *
 * Create a local snapshot that catches changes. This hook actually returns a wrapped snapshot in a proxy for
 * render optimization instead of a plain object compared to `snapshot()` method.
 * Rule of thumb: read from snapshots, mutate the source.
 * The component will only re-render when the parts of the state you access have changed, it is render-optimized.
 *
 * @example A
 * function Counter() {
 *   const snap = useSnapshot(state)
 *   return (
 *     <div>
 *       {snap.count}
 *       <button onClick={() => ++state.count}>+1</button>
 *     </div>
 *   )
 * }
 *
 * [Notes]
 * Every object inside your proxy also becomes a proxy (if you don't use "ref"), so you can also use them to create
 * the local snapshot as seen on example B.
 *
 * @example B
 * function ProfileName() {
 *   const snap = useSnapshot(state.profile)
 *   return (
 *     <div>
 *       {snap.name}
 *     </div>
 *   )
 * }
 *
 * Beware that you still can replace the child proxy with something else so it will break your snapshot. You can see
 * above what happens with the original proxy when you replace the child proxy.
 *
 * > console.log(state)
 * { profile: { name: "valtio" } }
 * > childState = state.profile
 * > console.log(childState)
 * { name: "valtio" }
 * > state.profile.name = "react"
 * > console.log(childState)
 * { name: "react" }
 * > state.profile = { name: "new name" }
 * > console.log(childState)
 * { name: "react" }
 * > console.log(state)
 * { profile: { name: "new name" } }
 *
 * `useSnapshot()` depends on the original reference of the child proxy so if you replace it with a new one, the component
 * that is subscribed to the old proxy won't receive new updates because it is still subscribed to the old one.
 *
 * In this case we recommend the example C or D. On both examples you don't need to worry with re-render,
 * because it is render-optimized.
 *
 * @example C
 * const snap = useSnapshot(state)
 * return (
 *   <div>
 *     {snap.profile.name}
 *   </div>
 * )
 *
 * @example D
 * const { profile } = useSnapshot(state)
 * return (
 *   <div>
 *     {profile.name}
 *   </div>
 * )
 */
export const useSnapshot = <T extends object>(
  proxyObject: T,
  options?: Options
): DeepResolveType<T> => {
  const [, forceUpdate] = useReducer((c) => c + 1, 0)
  const affected = new WeakMap()
  const lastAffected = useRef<typeof affected>()
  const prevSnapshot = useRef<DeepResolveType<T>>()
  const lastSnapshot = useRef<DeepResolveType<T>>()
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

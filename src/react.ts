/// <reference types="react/experimental" />

import ReactExports, {
  useCallback,
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  // affectedToPathList,
  createProxy as createProxyToCompare,
  getUntracked,
  isChanged,
} from 'proxy-compare'
// import { useSyncExternalStore } from 'use-sync-external-store/shim'
// This doesn't work in ESM, because use-sync-external-store only exposes CJS.
// See: https://github.com/pmndrs/valtio/issues/452
// The following is a workaround until ESM is supported.
import useSyncExternalStoreExports from 'use-sync-external-store/shim'
import { snapshot, subscribe } from './vanilla'
import type { INTERNAL_Snapshot as Snapshot } from './vanilla'

const use = ReactExports.experimental_use
const { useSyncExternalStore } = useSyncExternalStoreExports

// customized version of affectedToPathList
// we need to avoid invoking getters
const affectedToPathList = (
  obj: unknown,
  affected: WeakMap<object, unknown>
) => {
  const list: (string | symbol)[][] = []
  const seen = new WeakSet()
  const walk = (x: unknown, path?: (string | symbol)[]) => {
    if (seen.has(x as object)) {
      // for object with cycles
      return
    }
    let used: Set<string | symbol> | undefined
    if (typeof x === 'object' && x !== null) {
      seen.add(x)
      used = affected.get(getUntracked(x) || x) as any
    }
    if (used) {
      used.forEach((key) => {
        if ('value' in (Object.getOwnPropertyDescriptor(x, key) || {})) {
          walk((x as any)[key], path ? [...path, key] : [key])
        }
      })
    } else if (path) {
      list.push(path)
    }
  }
  walk(obj)
  return list
}

const useAffectedDebugValue = (
  state: object,
  affected: WeakMap<object, unknown>
) => {
  const pathList = useRef<(string | number | symbol)[][]>()
  useEffect(() => {
    pathList.current = affectedToPathList(state, affected)
  })
  useDebugValue(pathList.current)
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
export function useSnapshot<T extends object>(
  proxyObject: T,
  options?: Options
): Snapshot<T> {
  const notifyInSync = options?.sync
  const lastSnapshot = useRef<Snapshot<T>>()
  const lastAffected = useRef<WeakMap<object, unknown>>()
  let inRender = true
  const currSnapshot = useSyncExternalStore(
    useCallback(
      (callback) => {
        const unsub = subscribe(proxyObject, callback, notifyInSync)
        callback() // Note: do we really need this?
        return unsub
      },
      [proxyObject, notifyInSync]
    ),
    () => {
      const nextSnapshot = snapshot(proxyObject, use)
      try {
        if (
          !inRender &&
          lastSnapshot.current &&
          lastAffected.current &&
          !isChanged(
            lastSnapshot.current,
            nextSnapshot,
            lastAffected.current,
            new WeakMap()
          )
        ) {
          // not changed
          return lastSnapshot.current
        }
      } catch (e) {
        // ignore if a promise or something is thrown
      }
      return nextSnapshot
    },
    () => snapshot(proxyObject, use)
  )
  inRender = false
  const currAffected = new WeakMap()
  useEffect(() => {
    lastSnapshot.current = currSnapshot
    lastAffected.current = currAffected
  })
  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAffectedDebugValue(currSnapshot, currAffected)
  }
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createProxyToCompare(currSnapshot, currAffected, proxyCache)
}

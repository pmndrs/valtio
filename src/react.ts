import {
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { affectedToPathList } from 'proxy-compare'
import {
  getProxyBySnapshot,
  snapshot,
  subscribe,
  subscribeKey,
} from './vanilla.ts'
import type { Snapshot } from './vanilla.ts'

/**
 * React hook to display affected paths in React DevTools for debugging
 *
 * This internal hook collects the paths that were accessed during render
 * and displays them in React DevTools to help with debugging render optimizations.
 *
 * @param {object} state - The state object being tracked
 * @param {WeakMap<object, unknown>} affected - WeakMap of accessed properties
 * @private
 */
const useAffectedDebugValue = (
  state: object,
  affected: WeakMap<object, unknown>,
) => {
  const pathList = useRef<(string | number | symbol)[][]>(undefined)
  useEffect(() => {
    pathList.current = affectedToPathList(state, affected, true)
  })
  useDebugValue(pathList.current)
}
const condUseAffectedDebugValue = useAffectedDebugValue

type Options = {
  sync?: boolean
  initEntireSubscribe?: boolean
}

// function to create a new bare proxy
const newProxy = <T extends object>(target: T, handler: ProxyHandler<T>) =>
  new Proxy(target, handler)

// get object prototype
const getProto = Object.getPrototypeOf

const objectsToTrack = new WeakMap<object, boolean>()
export const markToTrack = (obj: object, mark = true): void => {
  objectsToTrack.set(obj, mark)
}

// check if obj is a plain object or an array
const isObjectToTrack = <T>(obj: T): obj is T extends object ? T : never =>
  obj &&
  (objectsToTrack.has(obj as unknown as object)
    ? (objectsToTrack.get(obj as unknown as object) as boolean)
    : getProto(obj) === Object.prototype || getProto(obj) === Array.prototype)

const getPropertyDescriptor = (obj: object, key: string | symbol) => {
  while (obj) {
    const desc = Reflect.getOwnPropertyDescriptor(obj, key)
    if (desc) {
      return desc
    }
    obj = getProto(obj)
  }
  return undefined
}

const HAS_KEY_PROPERTY = 'h'
const ALL_OWN_KEYS_PROPERTY = 'w'
const HAS_OWN_KEY_PROPERTY = 'o'
const KEYS_PROPERTY = 'k'
const NO_ACCESS_PROPERTY = 'n'

type HasKeySet = Set<string | symbol>
type HasOwnKeySet = Set<string | symbol>
type KeysSet = Set<string | symbol>
type Used = {
  [HAS_KEY_PROPERTY]?: HasKeySet
  [ALL_OWN_KEYS_PROPERTY]?: true
  [HAS_OWN_KEY_PROPERTY]?: HasOwnKeySet
  [KEYS_PROPERTY]?: KeysSet
  [NO_ACCESS_PROPERTY]?: true
}
type Affected = Map<object, Used>

const recordUsage = (
  proxyObject: object,
  affected: Affected,
  type:
    | typeof HAS_KEY_PROPERTY
    | typeof ALL_OWN_KEYS_PROPERTY
    | typeof HAS_OWN_KEY_PROPERTY
    | typeof KEYS_PROPERTY
    | typeof NO_ACCESS_PROPERTY,
  key?: string | symbol,
) => {
  let used = affected.get(proxyObject as object) as any
  if (!used) {
    used = {}
    affected.set(proxyObject as object, used)
  }

  if (type === NO_ACCESS_PROPERTY) {
    used[NO_ACCESS_PROPERTY] = true
    return
  } else {
    delete used[NO_ACCESS_PROPERTY]
  }

  if (type === ALL_OWN_KEYS_PROPERTY) {
    used[ALL_OWN_KEYS_PROPERTY] = true
  } else {
    let set = used[type]
    if (!set) {
      set = new Set()
      used[type] = set
    }
    set.add(key as string | symbol)
  }
}

const createSnapshotProxy = <T>(
  snapshot: Snapshot<T>,
  affected: Affected,
  proxyCache: WeakMap<object, Snapshot<T>>,
  notifyInSync?: boolean,
  initEntireSubscribe?: boolean,
): Snapshot<T> => {
  if (!isObjectToTrack(snapshot)) return snapshot
  if (proxyCache.get(snapshot)) return proxyCache.get(snapshot)!

  const proxyObject = getProxyBySnapshot(snapshot)
  const proxySnapshot = newProxy(snapshot, {
    get(target, prop) {
      const desc = getPropertyDescriptor(target, prop)
      if (desc?.get) {
        return Reflect.get(target, prop, proxySnapshot)
      }

      recordUsage(proxyObject, affected, KEYS_PROPERTY, prop)
      return createSnapshotProxy(
        Reflect.get(target, prop) as Snapshot<T>,
        affected,
        proxyCache,
        notifyInSync,
        initEntireSubscribe,
      )
    },
    has(target, key) {
      recordUsage(proxyObject, affected, HAS_KEY_PROPERTY, key)
      return Reflect.has(target, key)
    },
    getOwnPropertyDescriptor(target, key) {
      recordUsage(proxyObject, affected, HAS_OWN_KEY_PROPERTY, key)
      return Reflect.getOwnPropertyDescriptor(target, key)
    },
    ownKeys(target) {
      recordUsage(proxyObject, affected, ALL_OWN_KEYS_PROPERTY)
      return Reflect.ownKeys(target)
    },
  })
  proxyCache.set(snapshot, proxySnapshot)

  if (initEntireSubscribe) {
    recordUsage(proxyObject, affected, NO_ACCESS_PROPERTY)
  }
  return proxySnapshot
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
 * `useSnapshot()` depends on the original reference of the child proxy so if you replace it with a new one, the
 * component that is subscribed to the old proxy won't receive new updates because it is still subscribed to
 * the old one.
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
  options?: Options,
): Snapshot<T> {
  const notifyInSync = options?.sync
  const initEntireSubscribe = options?.initEntireSubscribe ?? true
  // per-proxy & per-hook affected, it's not ideal but memo compatible
  const affected = useMemo(
    () => proxyObject && (new Map() as Affected),
    [proxyObject],
  )

  const lastSnapshot = useRef<Snapshot<T>>(undefined)
  const currSnapshot = useSyncExternalStore(
    (callback) => {
      const unsubscribes = [] as (() => void)[]
      for (const obj of affected.keys()) {
        const used = affected.get(obj) as any
        if (used[ALL_OWN_KEYS_PROPERTY] || used[NO_ACCESS_PROPERTY]) {
          unsubscribes.push(subscribe(obj, callback, notifyInSync))
        } else {
          for (const type in used) {
            for (const key of used[type]) {
              unsubscribes.push(
                subscribeKey(obj as any, key, callback, notifyInSync),
              )
            }
          }
        }
      }
      return () => {
        unsubscribes.forEach((unsub) => unsub())
      }
    },
    () => snapshot(proxyObject),
    () => snapshot(proxyObject),
  )
  if (lastSnapshot.current !== currSnapshot) {
    affected.clear() // we re-subscribe affected in render
    lastSnapshot.current = currSnapshot
  }
  if (import.meta.env?.MODE !== 'production') {
    condUseAffectedDebugValue(proxyObject, affected)
  }
  const proxyCache = useMemo(() => new WeakMap(), []) // per-hook proxyCache
  return createSnapshotProxy(
    currSnapshot,
    affected,
    proxyCache,
    notifyInSync,
    initEntireSubscribe,
  )
}

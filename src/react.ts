import {
  useCallback,
  useDebugValue,
  useEffect,
  useLayoutEffect,
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

type Unsubscribe = () => void

type HasKeyMap = Map<string | symbol, Unsubscribe>
type HasOwnKeyMap = Map<string | symbol, Unsubscribe>
type KeysMap = Map<string | symbol, Unsubscribe>
type Used = {
  [HAS_KEY_PROPERTY]?: HasKeyMap
  [ALL_OWN_KEYS_PROPERTY]?: Unsubscribe
  [HAS_OWN_KEY_PROPERTY]?: HasOwnKeyMap
  [KEYS_PROPERTY]?: KeysMap
  [NO_ACCESS_PROPERTY]?: Unsubscribe
}
type Affected = Map<object, Used>

const recordUsage = (
  proxyObject: object,
  observer: SnapshotObserver,
  type:
    | typeof HAS_KEY_PROPERTY
    | typeof ALL_OWN_KEYS_PROPERTY
    | typeof HAS_OWN_KEY_PROPERTY
    | typeof KEYS_PROPERTY
    | typeof NO_ACCESS_PROPERTY,
  key?: string | symbol,
) => {
  const affected = observer.affected
  const notify = observer.notify
  const notifyInSync = observer.notifyInSync
  let used = affected.get(proxyObject as object)
  if (!used) {
    used = {}
    affected.set(proxyObject as object, used)
  }

  if (type === NO_ACCESS_PROPERTY) {
    used[NO_ACCESS_PROPERTY] = subscribe(proxyObject, notify, notifyInSync)
    return
  } else {
    used[NO_ACCESS_PROPERTY]?.()
    delete used[NO_ACCESS_PROPERTY]
  }

  if (type === ALL_OWN_KEYS_PROPERTY) {
    used[ALL_OWN_KEYS_PROPERTY] = subscribe(proxyObject, notify, notifyInSync)
  } else {
    let set = used[type]
    if (!set) {
      set = new Map()
      used[type] = set
    }
    const unsub = subscribeKey(proxyObject as any, key!, notify, notifyInSync)
    set.set(key!, unsub)
  }
}

const createSnapshotProxy = <T>(
  snapshot: Snapshot<T>,
  observer: SnapshotObserver,
): Snapshot<T> => {
  if (!isObjectToTrack(snapshot)) return snapshot

  const { proxyCache, initEntireSubscribe } = observer
  if (proxyCache.get(snapshot)) return proxyCache.get(snapshot)!

  const proxyObject = getProxyBySnapshot(snapshot)
  const proxySnapshot = newProxy(snapshot, {
    get(target, prop) {
      const desc = getPropertyDescriptor(target, prop)
      if (desc?.get) {
        return Reflect.get(target, prop, proxySnapshot)
      }

      recordUsage(proxyObject, observer, KEYS_PROPERTY, prop)
      return createSnapshotProxy(
        Reflect.get(target, prop) as Snapshot<T>,
        observer,
      )
    },
    has(target, key) {
      recordUsage(proxyObject, observer, HAS_KEY_PROPERTY, key)
      return Reflect.has(target, key)
    },
    getOwnPropertyDescriptor(target, key) {
      recordUsage(proxyObject, observer, HAS_OWN_KEY_PROPERTY, key)
      return Reflect.getOwnPropertyDescriptor(target, key)
    },
    ownKeys(target) {
      recordUsage(proxyObject, observer, ALL_OWN_KEYS_PROPERTY)
      return Reflect.ownKeys(target)
    },
  })
  proxyCache.set(snapshot, proxySnapshot)

  if (initEntireSubscribe) {
    recordUsage(proxyObject, observer, NO_ACCESS_PROPERTY)
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
  // per-proxy & per-hook observer, it's not ideal but memo compatible
  // eslint-disable-next-line react-hooks/react-compiler
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const observer = useMemo(() => new SnapshotObserver(options), [])
  useLayoutEffect(
    () => () => {
      observer.clear()
    },
    [observer],
  )

  const lastSnapshot = useRef<Snapshot<T>>(undefined)
  const currSnapshot = useSyncExternalStore(
    useCallback((callback) => observer.subscribe(callback), [observer]),
    () => observer.getSnapshot(proxyObject),
    () => observer.getSnapshot(proxyObject),
  )
  if (lastSnapshot.current !== currSnapshot) {
    observer.clear() // we re-subscribe affected in render
    lastSnapshot.current = currSnapshot
  }
  if (import.meta.env?.MODE !== 'production') {
    condUseAffectedDebugValue(proxyObject, observer.affected)
  }
  return currSnapshot
}

/**
 * SnapshotObserver
 *
 * A class that gets snapshots of a proxy object and auto observes changes.
 * Notify subscribers only when the snapshots accessed properties change.
 * Just like useSnapshot, but can use outside of React components.
 */
export class SnapshotObserver {
  affected: Affected = new Map()
  proxyCache: WeakMap<any, any> = new WeakMap()
  notifyInSync: boolean
  initEntireSubscribe: boolean
  listeners: Set<() => void> = new Set()

  constructor(options?: Options) {
    this.notifyInSync = options?.sync ?? false
    this.initEntireSubscribe = options?.initEntireSubscribe ?? true
  }

  getSnapshot<T extends object>(proxyObject: T): Snapshot<T> {
    const snap = snapshot(proxyObject)
    const snapProxy = createSnapshotProxy(snap, this)
    return snapProxy
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notify = (): void => {
    this.listeners.forEach((listener) => listener())
  }

  clear(): void {
    for (const [, used] of this.affected) {
      for (const key in used) {
        const type = key as keyof Used
        if (type === NO_ACCESS_PROPERTY || type === ALL_OWN_KEYS_PROPERTY) {
          used[type]?.()
        } else {
          const set = used[type]
          if (set) {
            for (const [, unsub] of set) {
              unsub()
            }
          }
        }
      }
    }
    this.affected.clear()
  }
}

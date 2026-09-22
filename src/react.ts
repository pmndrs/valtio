import { useMemo, useSyncExternalStore } from 'react'
import {
  snapshot,
  unstable_getInternalStates,
  unstable_replaceInternalFunction,
} from './vanilla.js'
import type { Snapshot } from './vanilla.js'

type Key = string | symbol
type RemoveListener = () => void
type Usage = Map<Key | undefined, number>
type UsedMap = Map<object, Usage>
type UsageListener = (
  currentUsedMap: UsedMap,
  snapshotObject: object,
  target: object,
  key?: Key,
  trackFlags?: number,
) => void
type TargetSubscription = {
  add: (key: Key | undefined, usage: Usage) => void
  remove: RemoveListener
}

const {
  proxyCache: stateProxyCache,
  proxyStateMap: stateProxyMap,
  refSet,
  snapshotProxyMap,
  detachmentVersions,
  accessorVersions,
  versionHolder,
} = unstable_getInternalStates()
const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null
const KEY_PROXY_CACHE = 'p'
const KEY_TRACK = 't'
const KEY_TOUCH = 'u'
const KEY_LINK = 'l'
const TRACK_VALUE = 1
const TRACK_HAS = 2
const TRACK_DESCRIPTOR = 4
const TRACK_KEYS = 8
const TRACK_CONTAINER = 16
const TRACK_TRAVERSE = 32
const TRACK_CURRENT_READ = 64
const TRACK_CURRENT_CONTAINER = 128

type SnapshotTracker = {
  [KEY_PROXY_CACHE]: WeakMap<object, object>
  [KEY_TRACK]: (
    snapshotObject: object,
    target: object,
    key?: Key,
    trackFlags?: number,
  ) => void
  [KEY_TOUCH]?: (snapshotObject: object) => void
  [KEY_LINK]?: (snapshotObject: object, child: object) => void
}

const snapshotTrackers = new WeakMap<
  object,
  readonly [snapshot: object, target: object, tracker: SnapshotTracker]
>()
const sourceIds = new WeakMap<object, object>()
const snapshotInfoMap = new WeakMap<
  object,
  readonly [sourceId: object, childKeys: Set<Key>]
>()

const registerSnapshot = (snapshotObject: object, target: object) => {
  if (snapshotInfoMap.has(snapshotObject)) {
    return
  }
  let sourceId = sourceIds.get(target)
  if (!sourceId) {
    sourceIds.set(target, (sourceId = {}))
  }
  const childKeys = new Set<Key>()
  snapshotInfoMap.set(snapshotObject, [sourceId, childKeys])
  Reflect.ownKeys(target).forEach((key) => {
    const property = Reflect.getOwnPropertyDescriptor(target, key)
    if (property && 'value' in property && !refSet.has(property.value)) {
      const childState = stateProxyMap.get(property.value)
      const childSnapshot = Reflect.getOwnPropertyDescriptor(
        snapshotObject,
        key,
      )?.value
      if (childState && isObject(childSnapshot)) {
        childKeys.add(key)
        registerSnapshot(childSnapshot, childState[0])
      }
    }
  })
}

let snapshotDepth = 0
unstable_replaceInternalFunction(
  'createSnapshot',
  (prev) => (target, version) => {
    snapshotDepth++
    try {
      const snap = prev(target, version)
      if (snapshotDepth === 1) {
        registerSnapshot(snap, target)
      }
      return snap
    } finally {
      snapshotDepth--
    }
  },
)

let activeGetter: SnapshotTracker | undefined
const addSnapshotUsage = (
  usedMap: UsedMap,
  target: object,
  key?: Key,
  trackFlags = TRACK_VALUE,
): void => {
  let usage = usedMap.get(target)
  if (!usage) {
    usage = new Map()
    usedMap.set(target, usage)
  }
  usage.set(key, (usage.get(key) || 0) | trackFlags)
}

const getPropertyDescriptor = (
  object: object,
  key: Key,
): PropertyDescriptor | undefined => {
  let current: object | null = object
  while (current) {
    const descriptor = Reflect.getOwnPropertyDescriptor(current, key)
    if (descriptor) {
      return descriptor
    }
    current = Reflect.getPrototypeOf(current) as object | null
  }
  return undefined
}

const getSnapshotKeyValue = (snapshotObject: object, key: Key): unknown => {
  const value = Reflect.get(snapshotObject, key)
  return snapshotInfoMap.get(snapshotObject)?.[1].has(key)
    ? snapshotInfoMap.get(value as object)?.[0]
    : value
}

const createSnapshotProxy = <T extends object>(
  snapshotObject: T,
  target: object,
  tracker: SnapshotTracker,
): T => {
  if (!Reflect.isExtensible(snapshotObject)) {
    throw new Error('non-extensible snapshots are not supported')
  }
  const {
    [KEY_PROXY_CACHE]: proxyCache,
    [KEY_TRACK]: track,
    [KEY_TOUCH]: touch,
    [KEY_LINK]: link,
  } = tracker
  touch?.(snapshotObject)
  const cached = proxyCache.get(snapshotObject) as T | undefined
  if (cached) {
    return cached
  }
  const childKeys = snapshotInfoMap.get(snapshotObject)![1]
  const getChildTarget = (key: Key, value: object) => {
    const property = Reflect.getOwnPropertyDescriptor(target, key)
    const childState =
      property && 'value' in property && stateProxyMap.get(property.value)
    return childState &&
      sourceIds.get(childState[0]) === snapshotInfoMap.get(value)?.[0]
      ? childState[0]
      : undefined
  }
  const proxySnapshot = new Proxy(snapshotObject, {
    get(snapshotObject, key, receiver) {
      const descriptor = getPropertyDescriptor(snapshotObject, key)
      if (descriptor?.get) {
        track(snapshotObject, target, key)
        const prevActiveGetter = activeGetter
        activeGetter = tracker
        try {
          return Reflect.get(snapshotObject, key, receiver) as unknown
        } finally {
          activeGetter = prevActiveGetter
        }
      }
      const value = Reflect.get(snapshotObject, key, receiver) as unknown
      const childTarget =
        isObject(value) && childKeys.has(key) && getChildTarget(key, value)
      if (childTarget) {
        track(
          snapshotObject,
          target,
          key,
          activeGetter === tracker ? TRACK_VALUE : TRACK_TRAVERSE,
        )
        track(value as object, childTarget, undefined, TRACK_CONTAINER)
        link?.(snapshotObject, value)
        return createSnapshotProxy(value as object, childTarget, tracker)
      }
      track(snapshotObject, target, key)
      return value
    },
    has(snapshotObject, key) {
      track(snapshotObject, target, key, TRACK_HAS)
      return Reflect.has(snapshotObject, key)
    },
    getOwnPropertyDescriptor(snapshotObject, key) {
      track(
        snapshotObject,
        target,
        key,
        activeGetter === tracker
          ? TRACK_VALUE | TRACK_DESCRIPTOR
          : TRACK_DESCRIPTOR,
      )
      const descriptor: PropertyDescriptor | undefined =
        Reflect.getOwnPropertyDescriptor(snapshotObject, key)
      const childTarget =
        descriptor &&
        childKeys.has(key) &&
        activeGetter === tracker &&
        getChildTarget(key, descriptor.value)
      if (childTarget) {
        track(descriptor.value, childTarget, undefined, TRACK_CONTAINER)
        link?.(snapshotObject, descriptor.value)
        descriptor.value = createSnapshotProxy(
          descriptor.value,
          childTarget,
          tracker,
        )
      }
      return descriptor
    },
    ownKeys(snapshotObject) {
      track(snapshotObject, target, undefined, TRACK_KEYS)
      return Reflect.ownKeys(snapshotObject)
    },
  })
  proxyCache.set(snapshotObject, proxySnapshot)
  snapshotProxyMap.set(proxySnapshot, snapshotObject)
  snapshotTrackers.set(proxySnapshot, [snapshotObject, target, tracker])
  return proxySnapshot
}

const KEY_BEGIN = 'b'
const KEY_LISTEN = 'n'

// Cached descendant reads must not narrow a fresh container-only read.
const usesContainer = (usage: Usage) => {
  const trackFlags = usage.get(undefined) || 0
  return (
    !!(trackFlags & TRACK_VALUE) ||
    (!!(trackFlags & TRACK_CONTAINER) &&
      (trackFlags & TRACK_CURRENT_CONTAINER
        ? !(trackFlags & TRACK_CURRENT_READ)
        : trackFlags === TRACK_CONTAINER && usage.size === 1))
  )
}

const hasChanged = (
  prev: object,
  next: object,
  usage: Usage,
  renderVersion: number,
  target: object,
) => {
  if (usesContainer(usage)) {
    return true
  }
  for (const [key, trackFlags] of usage) {
    if (trackFlags & TRACK_VALUE) {
      if (key === undefined) {
        return true
      }
      const prevDescriptor = getPropertyDescriptor(prev, key)
      const nextDescriptor = getPropertyDescriptor(next, key)
      if (
        prevDescriptor?.get || nextDescriptor?.get
          ? prevDescriptor?.get !== nextDescriptor?.get ||
            (accessorVersions.get(target)?.get(key) || 0) > renderVersion
          : !Object.is(
              getSnapshotKeyValue(prev, key),
              getSnapshotKeyValue(next, key),
            )
      ) {
        return true
      }
    }
    if (key !== undefined) {
      if (
        trackFlags & TRACK_HAS &&
        Reflect.has(prev, key) !== Reflect.has(next, key)
      ) {
        return true
      }
      if (
        trackFlags & TRACK_DESCRIPTOR &&
        Reflect.getOwnPropertyDescriptor(prev, key)?.enumerable !==
          Reflect.getOwnPropertyDescriptor(next, key)?.enumerable
      ) {
        return true
      }
    }
    if (trackFlags & TRACK_KEYS) {
      const prevKeys = Reflect.ownKeys(prev)
      const nextKeys = Reflect.ownKeys(next)
      if (
        prevKeys.length !== nextKeys.length ||
        prevKeys.some((key, index) => key !== nextKeys[index])
      ) {
        return true
      }
    }
  }
  return false
}

const addUsageToMap = (
  usedMap: UsedMap,
  target: object,
  key?: Key,
  trackFlags?: number,
) => {
  const prevTrackFlags = usedMap.get(target)?.get(key)
  addSnapshotUsage(usedMap, target, key, trackFlags)
  return prevTrackFlags !== usedMap.get(target)?.get(key)
}

const createSnapshotTracker = () => {
  const proxyCache = new WeakMap<object, object>()
  const usedMapCache = new WeakMap<object, UsedMap>()
  const childMap = new WeakMap<object, Set<object>>()
  const listeners = new Set<UsageListener>()
  let usedMap: UsedMap = new Map()
  let prevSnapshots = new Map<object, object>()
  let touched = new WeakSet<object>()

  const addUsage = (
    snapshotObject: object,
    target: object,
    key?: Key,
    trackFlags?: number,
  ) => {
    if (!prevSnapshots.has(target)) {
      prevSnapshots.set(target, snapshotObject)
    }
    if (addUsageToMap(usedMap, target, key, trackFlags)) {
      listeners.forEach((listener) =>
        listener(usedMap, snapshotObject, target, key, trackFlags),
      )
    }
  }

  const touch = (snapshotObject: object) => {
    if (touched.has(snapshotObject)) {
      return
    }
    touched.add(snapshotObject)
    usedMapCache
      .get(snapshotObject)
      ?.forEach((usage, target) =>
        usage.forEach((trackFlags, key) =>
          addUsage(snapshotObject, target, key, trackFlags),
        ),
      )
    childMap.get(snapshotObject)?.forEach(touch)
  }

  const track = (
    snapshotObject: object,
    target: object,
    key?: Key,
    trackFlags = TRACK_VALUE,
  ) => {
    let cache = usedMapCache.get(snapshotObject)
    if (!cache) {
      cache = new Map()
      usedMapCache.set(snapshotObject, cache)
    }
    addSnapshotUsage(cache, target, key, trackFlags)
    if (key !== undefined || trackFlags & TRACK_KEYS) {
      addUsage(snapshotObject, target, undefined, TRACK_CURRENT_READ)
    }
    addUsage(
      snapshotObject,
      target,
      key,
      trackFlags | (trackFlags & TRACK_CONTAINER ? TRACK_CURRENT_CONTAINER : 0),
    )
  }

  const link = (snapshotObject: object, child: object) => {
    let children = childMap.get(snapshotObject)
    if (!children) {
      children = new Set()
      childMap.set(snapshotObject, children)
    }
    children.add(child)
  }

  const begin = () => {
    usedMap = new Map()
    prevSnapshots = new Map()
    touched = new WeakSet()
    return [usedMap, prevSnapshots] as const
  }
  const listen = (listener: UsageListener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    [KEY_PROXY_CACHE]: proxyCache,
    [KEY_TRACK]: track,
    [KEY_TOUCH]: touch,
    [KEY_LINK]: link,
    [KEY_BEGIN]: begin,
    [KEY_LISTEN]: listen,
  }
}

type Options = {
  sync?: boolean
}

export function trackKey<T extends object, K extends keyof T>(
  snapshotObject: T,
  key: K,
): T[K] {
  const value = snapshotObject[key]
  const tracked = snapshotTrackers.get(snapshotObject)
  if (tracked) {
    const [snap, target, tracker] = tracked
    const child = isObject(value) && snapshotTrackers.get(value)
    if (child) {
      const [childSnapshot, childTarget] = child
      tracker[KEY_TRACK](childSnapshot, childTarget, undefined, TRACK_VALUE)
    } else {
      tracker[KEY_TRACK](
        snap,
        target,
        typeof key === 'symbol' ? key : String(key),
      )
    }
  }
  return value
}
export function useSnapshot<T extends object>(
  proxyObject: T,
  options?: Options,
): Snapshot<T> {
  const notifyInSync = options?.sync
  const tracker = useMemo(() => createSnapshotTracker(), [proxyObject])
  const begin = tracker[KEY_BEGIN]
  const listen = tracker[KEY_LISTEN]
  const [usedMap, prevSnapshots] = begin()
  const renderVersion = versionHolder[0]
  const isTargetChanged = (target: object) => {
    if ((detachmentVersions.get(target) || 0) > renderVersion) {
      return true
    }
    try {
      const usage = usedMap.get(target)
      const targetProxy = stateProxyCache.get(target)
      const previous = prevSnapshots.get(target)
      if (!usage || !targetProxy || !previous) {
        return true
      }
      const next = snapshot(targetProxy)
      return (
        previous !== next &&
        hasChanged(previous, next, usage, renderVersion, target)
      )
    } catch {
      return true
    }
  }
  const subscribeSnapshot = (listener: () => void) => {
    const subscriptions = new Map<object, TargetSubscription>()
    let active = true
    let pendingTargets: Set<object> | undefined
    let promise: Promise<void> | undefined
    const scheduleCheck = (target: object) => {
      pendingTargets ||= new Set()
      pendingTargets.add(target)
      if (!promise) {
        promise = Promise.resolve().then(() => {
          promise = undefined
          const targets = pendingTargets
          pendingTargets = undefined
          if (active && targets && [...targets].some(isTargetChanged)) {
            listener()
          }
        })
      }
    }
    const createTargetSubscription = (
      target: object,
      targetProxy: object,
    ): TargetSubscription | undefined => {
      const proxyState = stateProxyMap.get(targetProxy)
      if (!proxyState) {
        return undefined
      }
      const [, , addListener, addKeyListener] = proxyState
      let removes: RemoveListener[] = []
      let keys: Set<Key> | undefined = new Set()
      const notify = () => {
        if (notifyInSync) {
          if (isTargetChanged(target)) {
            listener()
          }
        } else {
          scheduleCheck(target)
        }
      }
      return {
        add: (key, usage) => {
          if (
            usesContainer(usage) ||
            (usage.get(undefined) || 0) & TRACK_KEYS
          ) {
            if (keys) {
              removes.forEach((remove) => remove())
              removes = [addListener(notify)]
              keys = undefined
            }
            return
          }
          if (!keys) {
            removes.forEach((remove) => remove())
            removes = []
            keys = new Set()
            usage.forEach((trackFlags, key) => {
              if (
                key !== undefined &&
                trackFlags & (TRACK_VALUE | TRACK_HAS | TRACK_DESCRIPTOR)
              ) {
                keys!.add(key)
                removes.push(addKeyListener(key, notify))
              }
            })
          }
          if (
            key === undefined ||
            !(
              (usage.get(key) || 0) &
              (TRACK_VALUE | TRACK_HAS | TRACK_DESCRIPTOR)
            ) ||
            keys.has(key)
          ) {
            return
          }
          keys.add(key)
          removes.push(addKeyListener(key, notify))
        },
        remove: () => removes.forEach((remove) => remove()),
      }
    }
    const addTargetSubscription = (
      target: object,
      previousSnapshot?: object,
    ) => {
      const usage = usedMap.get(target)
      const targetProxy = stateProxyCache.get(target)
      if (!usage || !targetProxy) {
        return
      }
      if (!prevSnapshots.has(target)) {
        prevSnapshots.set(
          target,
          previousSnapshot &&
            snapshotInfoMap.get(previousSnapshot)?.[0] === sourceIds.get(target)
            ? previousSnapshot
            : snapshot(targetProxy),
        )
      }
      const subscription = createTargetSubscription(target, targetProxy)
      if (subscription) {
        usage.forEach((_, key) => subscription.add(key, usage))
        subscriptions.set(target, subscription)
      }
    }
    const updateSubscription = (
      currentUsedMap: UsedMap,
      snapshotObject: object,
      target: object,
      key?: Key,
      trackFlags?: number,
    ) => {
      const previousUsage = usedMap.get(target)
      const keepContainer =
        currentUsedMap !== usedMap &&
        previousUsage &&
        usesContainer(previousUsage)
      if (
        currentUsedMap !== usedMap &&
        !addUsageToMap(usedMap, target, key, trackFlags)
      ) {
        return
      }
      if (keepContainer) {
        addUsageToMap(usedMap, target, undefined, TRACK_VALUE)
      }
      const subscription = subscriptions.get(target)
      if (subscription) {
        subscription.add(key, usedMap.get(target)!)
      } else {
        addTargetSubscription(target, snapshotObject)
      }
      scheduleCheck(target)
    }
    const removeUsageListener = listen(updateSubscription)
    usedMap.forEach((_, target) => addTargetSubscription(target))
    return () => {
      active = false
      removeUsageListener()
      subscriptions.forEach(({ remove }) => remove())
    }
  }
  const renderSnapshot = snapshot(proxyObject)
  const getSnapshot = () => {
    const nextSnapshot = snapshot(proxyObject)
    if (renderSnapshot === nextSnapshot) {
      return nextSnapshot
    }
    for (const target of usedMap.keys()) {
      if (isTargetChanged(target)) {
        return nextSnapshot
      }
    }
    return renderSnapshot
  }
  const currSnapshot = useSyncExternalStore(
    subscribeSnapshot,
    getSnapshot,
    getSnapshot,
  )

  return createSnapshotProxy(
    currSnapshot as object,
    stateProxyMap.get(proxyObject)![0],
    tracker,
  ) as Snapshot<T>
}

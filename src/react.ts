import { useMemo, useSyncExternalStore } from 'react'
import { INTERNAL_UNWRAP } from './unwrap.js'
import { getVersion, isProxyObject, snapshot, subscribe } from './vanilla.js'
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

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null
const KEY_PROXY_CACHE = 'p'
const KEY_TRACK = 't'
const KEY_TOUCH = 'u'
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
}

type SnapshotBinding = {
  snapshot: object
  target: object
  tracker: SnapshotTracker
  children: Map<Key, object>
  usage: Usage
  accessors: Map<Key, number | undefined>
}
const snapshotTrackers = new WeakMap<object, SnapshotBinding>()
const getBinding = (snapshotObject: object, tracker: SnapshotTracker) => {
  const tracked = tracker[KEY_PROXY_CACHE].get(snapshotObject)
  return tracked && snapshotTrackers.get(tracked)
}

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
  } = tracker
  touch?.(snapshotObject)
  const cached = proxyCache.get(snapshotObject) as T | undefined
  if (cached) {
    return cached
  }
  const binding: SnapshotBinding = {
    snapshot: snapshotObject,
    target,
    tracker,
    children: new Map(),
    usage: new Map(),
    accessors: new Map(),
  }
  const getChildTarget = (key: Key, value: object) => {
    const property = Reflect.getOwnPropertyDescriptor(target, key)
    if (!property || !('value' in property) || property.value === value) return
    const cached = getBinding(value, tracker)
    const child = cached
      ? cached.target
      : isProxyObject(property.value) && snapshot(property.value) === value
        ? property.value
        : undefined
    if (child) binding.children.set(key, child)
    return child
  }
  const proxySnapshot = new Proxy(snapshotObject, {
    get(snapshotObject, key, receiver) {
      if (key === INTERNAL_UNWRAP) return snapshotObject
      const descriptor = getPropertyDescriptor(snapshotObject, key)
      if (descriptor?.get) {
        track(snapshotObject, target, key)
        const prevActiveGetter = activeGetter
        activeGetter = tracker
        try {
          const value = Reflect.get(snapshotObject, key, receiver) as unknown
          if (getPropertyDescriptor(target, key)?.set) {
            binding.accessors.set(key, getVersion(target, key))
          }
          return value
        } finally {
          activeGetter = prevActiveGetter
        }
      }
      const value = Reflect.get(snapshotObject, key, receiver) as unknown
      const childTarget = isObject(value) && getChildTarget(key, value)
      if (childTarget) {
        track(
          snapshotObject,
          target,
          key,
          activeGetter === tracker ? TRACK_VALUE : TRACK_TRAVERSE,
        )
        const child = createSnapshotProxy(value as object, childTarget, tracker)
        track(value as object, childTarget, undefined, TRACK_CONTAINER)
        return child
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
        activeGetter === tracker &&
        getChildTarget(key, descriptor.value)
      if (childTarget) {
        const childSnapshot = descriptor.value
        descriptor.value = createSnapshotProxy(
          descriptor.value,
          childTarget,
          tracker,
        )
        track(childSnapshot, childTarget, undefined, TRACK_CONTAINER)
      }
      return descriptor
    },
    ownKeys(snapshotObject) {
      track(snapshotObject, target, undefined, TRACK_KEYS)
      return Reflect.ownKeys(snapshotObject)
    },
  })
  proxyCache.set(snapshotObject, proxySnapshot)
  snapshotTrackers.set(proxySnapshot, binding)
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
  target: object,
  binding: SnapshotBinding | undefined,
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
            (!!binding &&
              binding.accessors.has(key) &&
              binding.accessors.get(key) !== getVersion(target, key))
          : !Object.is(
              binding && binding.children.has(key)
                ? binding.children.get(key)
                : Reflect.get(prev, key),
              binding && binding.children.has(key)
                ? Reflect.getOwnPropertyDescriptor(target, key)?.value
                : Reflect.get(next, key),
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
    const tracked = proxyCache.get(snapshotObject)
    const binding = tracked && snapshotTrackers.get(tracked)
    if (binding) {
      binding.usage.forEach((trackFlags, key) =>
        addUsage(snapshotObject, binding.target, key, trackFlags),
      )
      binding.children.forEach((_, key) =>
        touch(Reflect.getOwnPropertyDescriptor(snapshotObject, key)!.value),
      )
    }
  }

  const track = (
    snapshotObject: object,
    target: object,
    key?: Key,
    trackFlags = TRACK_VALUE,
  ) => {
    const tracked = proxyCache.get(snapshotObject)!
    const cache = snapshotTrackers.get(tracked)!.usage
    cache.set(key, (cache.get(key) || 0) | trackFlags)
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
    const { snapshot: snap, target, tracker } = tracked
    const child = isObject(value) && snapshotTrackers.get(value)
    if (child) {
      const { snapshot: childSnapshot, target: childTarget } = child
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
  const hasReplacements = () => {
    for (const [parent, usage] of usedMap) {
      const previous = prevSnapshots.get(parent)
      const binding = previous && getBinding(previous, tracker)
      if (binding) {
        for (const [key, child] of binding.children) {
          if (
            usage.has(key) &&
            Reflect.getOwnPropertyDescriptor(parent, key)?.value !== child
          ) {
            return true
          }
        }
      }
    }
    return false
  }
  const isTargetChanged = (target: object) => {
    try {
      const usage = usedMap.get(target)
      const previous = prevSnapshots.get(target)
      if (!usage || !previous) {
        return true
      }
      const next = snapshot(target)
      return (
        previous !== next &&
        hasChanged(previous, next, usage, target, getBinding(previous, tracker))
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
          if (
            active &&
            targets &&
            (hasReplacements() || [...targets].some(isTargetChanged))
          ) {
            listener()
          }
        })
      }
    }
    const createTargetSubscription = (target: object): TargetSubscription => {
      const removes = new Map<Key | undefined, RemoveListener>()
      const remove = () => {
        removes.forEach((stop) => stop())
        removes.clear()
      }
      const notify = () => {
        if (notifyInSync) {
          if (hasReplacements() || isTargetChanged(target)) listener()
        } else {
          scheduleCheck(target)
        }
      }
      const addKey = (key: Key | undefined, usage: Usage) => {
        if (
          key !== undefined &&
          !removes.has(key) &&
          (usage.get(key) || 0) & (TRACK_VALUE | TRACK_HAS | TRACK_DESCRIPTOR)
        ) {
          removes.set(
            key,
            subscribe(target, notify, {
              keys: [key as never],
              sync: true,
              recursive: false,
            }),
          )
        }
      }
      return {
        add: (key, usage) => {
          const whole =
            usesContainer(usage) || !!((usage.get(undefined) || 0) & TRACK_KEYS)
          if (whole) {
            if (!removes.has(undefined)) {
              remove()
              removes.set(undefined, subscribe(target, notify, true))
            }
          } else {
            if (removes.has(undefined)) {
              remove()
              usage.forEach((_, key) => addKey(key, usage))
            } else {
              addKey(key, usage)
            }
          }
        },
        remove,
      }
    }
    const addTargetSubscription = (
      target: object,
      previousSnapshot?: object,
    ) => {
      const usage = usedMap.get(target)
      if (!usage) {
        return
      }
      if (!prevSnapshots.has(target)) {
        prevSnapshots.set(target, previousSnapshot || snapshot(target))
      }
      const subscription = createTargetSubscription(target)
      usage.forEach((_, key) => subscription.add(key, usage))
      subscriptions.set(target, subscription)
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
    if (hasReplacements()) return nextSnapshot
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
    proxyObject,
    tracker,
  ) as Snapshot<T>
}

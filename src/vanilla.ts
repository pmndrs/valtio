import { getUntracked, markToTrack } from './vanilla/proxyCompare.js'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

/** Function type for any kind of function */
type AnyFunction = (...args: any[]) => any

/** Object that can be proxied */
type ProxyObject = object

/** Function called when a proxy object changes */
type Listener = () => void

/** JavaScript primitive types */
type Primitive = string | number | boolean | null | undefined | symbol | bigint

/** Types that should not be proxied in snapshots */
type SnapshotIgnore =
  | Date
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | Error
  | RegExp
  | AnyFunction
  | Primitive

/**
 * Snapshot type that converts objects to readonly versions recursively
 */
export type Snapshot<T> = T extends { $$valtioSnapshot: infer S }
  ? S
  : T extends SnapshotIgnore
    ? T
    : T extends object
      ? { readonly [K in keyof T]: Snapshot<T[K]> }
      : T

type RemoveListener = () => void
// Without keys, the listener hears every write in the proxy's subtree.
// With keys, it hears only direct writes to them, and OWN_KEYS stands for
// a key being added or removed.
type AddListener = (
  listener: Listener,
  keys?: readonly (string | symbol)[],
) => RemoveListener

// Updates a proxy for a write and queues its subtree listeners.
// It returns the proxy's parent links the first time the write reaches it.
type Visit = (nextVersion: number) => Set<ParentLink> | undefined

// A link from a child to one parent, under one key.
// It is weak, so a parent that is no longer used can be collected.
// The parent is a WeakRef, typed by its shape so that the public
// declarations don't require the ES2021 lib.
type ParentLink = readonly [
  parent: { deref(): Visit | undefined },
  key: string | symbol,
]

type ProxyState = readonly [
  target: object,
  ensureVersion: () => number,
  addListener: AddListener,
  parentLinks: Set<ParentLink>,
]

const canProxyDefault = (x: unknown): boolean =>
  isObject(x) &&
  !refSet.has(x) &&
  (Array.isArray(x) || !(Symbol.iterator in x)) &&
  !(x instanceof WeakMap) &&
  !(x instanceof WeakSet) &&
  !(x instanceof Error) &&
  !(x instanceof Number) &&
  !(x instanceof Date) &&
  !(x instanceof String) &&
  !(x instanceof RegExp) &&
  !(x instanceof ArrayBuffer) &&
  !(x instanceof Promise)

const createSnapshotDefault = <T extends object>(
  target: T,
  version: number,
): T => {
  const cache = snapCache.get(target)
  if (cache?.[0] === version) {
    return cache[1] as T
  }
  const snap: any = Array.isArray(target)
    ? []
    : Object.create(Object.getPrototypeOf(target))
  markToTrack(snap, true) // mark to track
  snapCache.set(target, [version, snap])
  Reflect.ownKeys(target).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(snap, key)) {
      // Only the known case is Array.length so far.
      return
    }
    const value = Reflect.get(target, key)
    const { enumerable } = Reflect.getOwnPropertyDescriptor(
      target,
      key,
    ) as PropertyDescriptor
    const desc: PropertyDescriptor = {
      value,
      enumerable: enumerable as boolean,
      // This is intentional to avoid copying in createProxy.
      // It's still non-writable, so it avoids assigning a value.
      configurable: true,
    }
    if (refSet.has(value as object)) {
      markToTrack(value as object, false) // mark not to track
    } else if (proxyStateMap.has(value as object)) {
      const [target, ensureVersion] = proxyStateMap.get(
        value as object,
      ) as ProxyState
      desc.value = createSnapshotDefault(target, ensureVersion()) as Snapshot<T>
    }
    Object.defineProperty(snap, key, desc)
  })
  // Object.preventExtensions is removed. ref: https://github.com/pmndrs/valtio/pull/1220
  return snap
}

const hasOwn = (obj: object, key: string | symbol): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key)

const createHandlerDefault = <T extends object>(
  isInitializing: () => boolean,
  addChildListener: (key: string | symbol, value: unknown) => void,
  removeChildListener: (key: string | symbol) => void,
  notifyUpdate: (keys: readonly (string | symbol)[]) => void,
  findRemovableKeys: (newLength: number) => readonly (string | symbol)[],
): ProxyHandler<T> => ({
  deleteProperty(target: T, key: string | symbol) {
    const hadKey = hasOwn(target, key)
    removeChildListener(key)
    const deleted = Reflect.deleteProperty(target, key)
    if (deleted && hadKey) {
      notifyUpdate([key, OWN_KEYS])
    }
    return deleted
  },
  set(target: T, key: string | symbol, value: any, receiver: object) {
    const hasPrevValue = !isInitializing() && Reflect.has(target, key)
    const prevValue = Reflect.get(target, key, receiver)
    if (
      hasPrevValue &&
      (objectIs(prevValue, value) ||
        (proxyCache.has(value) && objectIs(prevValue, proxyCache.get(value))))
    ) {
      return true
    }
    const hadKey = hasOwn(target, key)
    const length = Array.isArray(target) && target.length
    // A shorter length removes indices without this trap, so the keys it
    // can remove are listed before the write and checked after it.
    const removableKeys =
      key === 'length' && length !== false && value < length
        ? findRemovableKeys(Number(value))
        : []
    removeChildListener(key)
    if (isObject(value)) {
      value = getUntracked(value) || value
    }
    const nextValue =
      !proxyStateMap.has(value) && canProxy(value) ? proxy(value) : value
    addChildListener(key, nextValue)
    Reflect.set(target, key, nextValue, receiver)
    const keys = [key]
    if (!hadKey && hasOwn(target, key)) {
      keys.push(OWN_KEYS)
    }
    // An index past the end lengthens an array without this trap, too.
    if (length !== false && key !== 'length' && target.length !== length) {
      keys.push('length')
    }
    removableKeys.forEach((removableKey) => {
      if (!hasOwn(target, removableKey)) {
        removeChildListener(removableKey)
        keys.push(removableKey)
      }
    })
    notifyUpdate(keys)
    return true
  },
})

// internal states
const proxyStateMap: WeakMap<ProxyObject, ProxyState> = new WeakMap()
const refSet: WeakSet<object> = new WeakSet()
const snapCache: WeakMap<object, [version: number, snap: unknown]> =
  new WeakMap()
const versionHolder = [1] as [number]
const proxyCache: WeakMap<object, ProxyObject> = new WeakMap()
// Children reach their parents only through WeakRef, so a proxy with
// listeners is held here until they are removed. Through its handler, it
// keeps alive the visit function that the WeakRefs point to.
const subscribedProxies: Set<object> = new Set()
// The key that listeners for own keys being added or removed are under.
const OWN_KEYS = Symbol()

// notification delivery
type Subscription = {
  callback: () => void
  active: boolean
}
let batchDepth = 0
let isDelivering = false
let pendingSubscriptions = new Set<Subscription>()

const deliver = (): unknown[] => {
  const errors: unknown[] = []
  isDelivering = true
  try {
    // Writes made by callbacks are queued for the next round, and delivered
    // together, so no subscription runs for a write before every
    // subscription has run for the writes made before it.
    while (pendingSubscriptions.size) {
      const round = pendingSubscriptions
      pendingSubscriptions = new Set()
      round.forEach((subscription) => {
        if (subscription.active) {
          // Called as a plain function, so `this` isn't the subscription.
          const { callback } = subscription
          try {
            callback()
          } catch (error) {
            errors.push(error)
          }
        }
      })
    }
  } finally {
    isDelivering = false
  }
  return errors
}

const noErrors: readonly unknown[] = []

const deliverIfOutermost = (): readonly unknown[] =>
  batchDepth || isDelivering || !pendingSubscriptions.size
    ? noErrors
    : deliver()

const throwIfErrors = (errors: readonly unknown[]) => {
  if (errors.length) {
    throw new AggregateError(errors, 'subscribe callback failed')
  }
}

// A write outside batch() never throws because of a subscriber,
// so that multi-step writes such as array methods always complete.
const reportErrors = (errors: readonly unknown[]) => {
  errors.forEach((error) =>
    queueMicrotask(() => {
      throw error
    }),
  )
}

// Pushes a write's version to every ancestor linked when it starts,
// nearest first, without growing the call stack.
const pushVersion = (visit: Visit, nextVersion: number) => {
  // Every write is delivered like a batch of one, so that all
  // subscriptions notified by it are queued before any callback runs.
  ++batchDepth
  try {
    const queue = [visit]
    for (const visitNode of queue) {
      visitNode(nextVersion)?.forEach((link, _, parentLinks) => {
        const visitParent = link[0].deref()
        if (!visitParent) {
          parentLinks.delete(link)
          return
        }
        queue.push(visitParent)
      })
    }
  } finally {
    --batchDepth
  }
  reportErrors(deliverIfOutermost())
}

// internal functions
let objectIs: (a: unknown, b: unknown) => boolean = Object.is
let newProxy = <T extends object>(target: T, handler: ProxyHandler<T>): T =>
  new Proxy(target, handler)
let canProxy: typeof canProxyDefault = canProxyDefault
let createSnapshot: typeof createSnapshotDefault = createSnapshotDefault
let createHandler: typeof createHandlerDefault = createHandlerDefault

/**
 * Creates a reactive proxy object that can be tracked for changes
 */
export function proxy<T extends object>(baseObject: T = {} as T): T {
  if (!isObject(baseObject)) {
    throw new Error('object required')
  }
  if (typeof WeakRef === 'undefined') {
    throw new Error(
      'Valtio requires WeakRef. On React Native, use the New Architecture.',
    )
  }
  const found = proxyCache.get(baseObject) as T | undefined
  if (found) {
    return found
  }
  let version = versionHolder[0]
  let linked = false
  let selfRef: WeakRef<Visit> | undefined
  const listeners = new Set<Listener>()
  const keyListeners = new Map<string | symbol, Set<Listener>>()
  const parentLinks = new Set<ParentLink>()
  const visit: Visit = (nextVersion) => {
    if (version === nextVersion) {
      return undefined
    }
    version = nextVersion
    listeners.forEach((listener) => listener())
    return parentLinks
  }
  const notifyUpdate = (keys: readonly (string | symbol)[]) => {
    keys.forEach((key) =>
      keyListeners.get(key)?.forEach((listener) => listener()),
    )
    pushVersion(visit, ++versionHolder[0])
  }
  const childProxyStates = new Map<
    string | symbol,
    readonly [ProxyState, ParentLink | undefined]
  >()
  const linkChild = (key: string | symbol, childProxyState: ProxyState) => {
    selfRef ||= new WeakRef(visit)
    const link: ParentLink = [selfRef, key]
    childProxyState[3].add(link)
    childProxyState[1]() // link the child's subtree
    return link
  }
  let sweepAt = 8
  // Links this proxy's subtree the first time something needs it.
  // After that, every write in the subtree pushes its version here.
  const ensureVersion = () => {
    if (!linked) {
      linked = true
      childProxyStates.forEach(([childProxyState], key) => {
        childProxyStates.set(key, [
          childProxyState,
          linkChild(key, childProxyState),
        ])
      })
    }
    // A parent calls this right after linking to this proxy. Dropping
    // dead links whenever their number has doubled since the last sweep
    // bounds them even if this proxy is never written.
    if (parentLinks.size >= sweepAt) {
      parentLinks.forEach((link) => {
        if (!link[0].deref()) {
          parentLinks.delete(link)
        }
      })
      sweepAt = parentLinks.size * 2 + 8
    }
    return version
  }
  const addChildListener = (key: string | symbol, value: unknown) => {
    const childProxyState =
      !refSet.has(value as object) && proxyStateMap.get(value as object)
    if (childProxyState) {
      if (process.env.NODE_ENV !== 'production' && childProxyStates.has(key)) {
        throw new Error('child listener already exists')
      }
      childProxyStates.set(key, [
        childProxyState,
        linked ? linkChild(key, childProxyState) : undefined,
      ])
    }
  }
  // Lists, before this array is shortened to newLength, the own keys it may
  // remove, at least those with a child or a key listener. It reads those
  // keys or the indices past newLength, whichever are fewer, so the holes of
  // a sparse array cost nothing. OWN_KEYS is added if an own index past
  // newLength exists and something listens for it.
  const findRemovableKeys = (newLength: number) => {
    const length = (baseObject as unknown[]).length
    const removableKeys: (string | symbol)[] = []
    const add = (key: string | symbol) => {
      if (hasOwn(baseObject, key)) {
        removableKeys.push(key)
      }
    }
    if (length - newLength > childProxyStates.size + keyListeners.size) {
      childProxyStates.forEach((_, key) => add(key))
      keyListeners.forEach((_, key) => add(key))
    } else {
      for (let i = newLength; i < length; i++) {
        add(String(i))
      }
    }
    if (keyListeners.has(OWN_KEYS)) {
      // From the end, which stops at once on a dense array
      for (let i = length; i-- > newLength; ) {
        if (hasOwn(baseObject, String(i))) {
          removableKeys.push(OWN_KEYS)
          break
        }
      }
    }
    return removableKeys
  }
  const removeChildListener = (key: string | symbol) => {
    const entry = childProxyStates.get(key)
    if (entry) {
      childProxyStates.delete(key)
      if (entry[1]) {
        entry[0][3].delete(entry[1])
      }
    }
  }
  const addListener: AddListener = (listener, keys) => {
    if (keys) {
      // A key listener doesn't need the subtree, so it links nothing.
      keys.forEach((key) => {
        let keyListenerSet = keyListeners.get(key)
        if (!keyListenerSet) {
          keyListeners.set(key, (keyListenerSet = new Set()))
        }
        keyListenerSet.add(listener)
      })
    } else {
      ensureVersion()
      listeners.add(listener)
    }
    subscribedProxies.add(proxyObject)
    const removeListener = () => {
      if (keys) {
        keys.forEach((key) => {
          const keyListenerSet = keyListeners.get(key)
          keyListenerSet?.delete(listener)
          if (!keyListenerSet?.size) {
            keyListeners.delete(key)
          }
        })
      } else {
        listeners.delete(listener)
      }
      if (!listeners.size && !keyListeners.size) {
        subscribedProxies.delete(proxyObject)
      }
    }
    return removeListener
  }
  let initializing = true
  const handler = createHandler<T>(
    () => initializing,
    addChildListener,
    removeChildListener,
    notifyUpdate,
    findRemovableKeys,
  )
  const proxyObject = newProxy(baseObject, handler)
  proxyCache.set(baseObject, proxyObject)
  const proxyState: ProxyState = [
    baseObject,
    ensureVersion,
    addListener,
    parentLinks,
  ]
  proxyStateMap.set(proxyObject, proxyState)
  Reflect.ownKeys(baseObject).forEach((key) => {
    const desc = Object.getOwnPropertyDescriptor(
      baseObject,
      key,
    ) as PropertyDescriptor
    if ('value' in desc && desc.writable) {
      proxyObject[key as keyof T] = baseObject[key as keyof T]
    }
  })
  initializing = false
  return proxyObject
}

/**
 * Checks whether a value is a proxy object created by `proxy`
 *
 * Snapshots, plain objects and objects marked with `ref` are not proxy
 * objects. A proxy marked with `ref` is still a proxy object.
 */
export function isProxyObject(x: unknown): boolean {
  return proxyStateMap.has(x as object)
}

/**
 * Subscribes to changes in a proxy object
 *
 * Without options, the callback runs for every write in the proxy's subtree.
 * With options, it runs only for what they list:
 * - `keys`: a set or delete of one of these keys on the proxy itself,
 *   including an array's `length` changed by writing an index, and the
 *   indices deleted by a shorter `length`
 * - `ownKeys`: a key added to or removed from the proxy
 *
 * The callback runs synchronously after each write, before the write
 * returns. Use `batch` to group several writes into one notification.
 * A write made inside a callback is the exception: it returns first, and
 * is delivered after the current callbacks, together with the other writes
 * made during them.
 * An error thrown by the callback is rethrown in a microtask, unless the
 * write is inside `batch`, which throws it.
 */
export function subscribe<T extends object>(
  proxyObject: T,
  callback: () => void,
  options?: {
    keys?: readonly (string | symbol)[]
    ownKeys?: boolean
  },
): () => void {
  if (typeof options === 'boolean') {
    throw new Error(
      'notifyInSync has been removed. subscribe() is synchronous. Use batch() to group notifications.',
    )
  }
  const keys = options?.keys
  if (keys !== undefined && !Array.isArray(keys)) {
    throw new Error('keys must be an array')
  }
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (process.env.NODE_ENV !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const addListener = (proxyState as ProxyState)[2]
  const subscription: Subscription = { callback, active: false }
  const removeListener = addListener(
    () => pendingSubscriptions.add(subscription),
    options && [...(keys || []), ...(options.ownKeys ? [OWN_KEYS] : [])],
  )
  subscription.active = true
  return () => {
    subscription.active = false
    removeListener()
  }
}

/**
 * Groups writes so that subscribers are notified once
 *
 * Callbacks are deferred until the outermost `batch` returns. Each
 * subscription then runs once.
 * Writes are visible to reads and `snapshot` immediately.
 * Errors thrown by callbacks are thrown from `batch` as an `AggregateError`.
 */
export function batch<T>(fn: () => T): T {
  return runBatch(fn, true)
}

// For utils such as proxyMap: groups writes like batch(), but reports
// callback errors like a single write, so only the caller's batch() throws.
const batchAsWrite = <T>(fn: () => T): T => runBatch(fn, false)

const runBatch = <T>(fn: () => T, throwErrors: boolean): T => {
  ++batchDepth
  let result: T
  try {
    result = fn()
  } catch (error) {
    --batchDepth
    const errors = deliverIfOutermost()
    if (throwErrors && errors.length) {
      throw new AggregateError([error, ...errors], 'batch failed')
    }
    reportErrors(errors)
    throw error
  }
  --batchDepth
  const errors = deliverIfOutermost()
  if (throwErrors) {
    throwIfErrors(errors)
  } else {
    reportErrors(errors)
  }
  return result
}

/**
 * Creates an immutable snapshot of the current state of a proxy object
 */
export function snapshot<T extends object>(proxyObject: T): Snapshot<T> {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (process.env.NODE_ENV !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const [target, ensureVersion] = proxyState as ProxyState
  return createSnapshot(target, ensureVersion()) as Snapshot<T>
}

/**
 * Marks an object to be excluded from proxying
 *
 * Objects marked with ref will be kept as references in snapshots
 * instead of being deeply copied.
 */
export function ref<T extends object>(obj: T) {
  refSet.add(obj)
  return obj as T & { $$valtioSnapshot: T }
}

// ------------------------------------------------
// unstable APIs (subject to change without notice)
// ------------------------------------------------

/**
 * Checks whether an object is marked with `ref`
 */
export function unstable_isRef(x: unknown): boolean {
  return refSet.has(x as object)
}

export function unstable_getInternalStates(): {
  proxyStateMap: typeof proxyStateMap
  refSet: typeof refSet
  snapCache: typeof snapCache
  versionHolder: typeof versionHolder
  proxyCache: typeof proxyCache
  batchAsWrite: typeof batchAsWrite
} {
  return {
    proxyStateMap,
    refSet,
    snapCache,
    versionHolder,
    proxyCache,
    batchAsWrite,
  }
}

export function unstable_replaceInternalFunction(
  name: 'objectIs',
  fn: (prev: typeof objectIs) => typeof objectIs,
): void

export function unstable_replaceInternalFunction(
  name: 'newProxy',
  fn: (prev: typeof newProxy) => typeof newProxy,
): void

export function unstable_replaceInternalFunction(
  name: 'canProxy',
  fn: (prev: typeof canProxy) => typeof canProxy,
): void

export function unstable_replaceInternalFunction(
  name: 'createSnapshot',
  fn: (prev: typeof createSnapshot) => typeof createSnapshot,
): void

export function unstable_replaceInternalFunction(
  name: 'createHandler',
  fn: (prev: typeof createHandler) => typeof createHandler,
): void

export function unstable_replaceInternalFunction(
  name:
    | 'objectIs'
    | 'newProxy'
    | 'canProxy'
    | 'createSnapshot'
    | 'createHandler',
  fn: (prev: any) => any,
) {
  switch (name) {
    case 'objectIs':
      objectIs = fn(objectIs)
      break
    case 'newProxy':
      newProxy = fn(newProxy)
      break
    case 'canProxy':
      canProxy = fn(canProxy)
      break
    case 'createSnapshot':
      createSnapshot = fn(createSnapshot)
      break
    case 'createHandler':
      createHandler = fn(createHandler)
      break
    default:
      throw new Error('unknown function')
  }
}

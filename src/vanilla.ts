import { getUntracked, markToTrack } from 'proxy-compare'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

/** Function type for any kind of function */
type AnyFunction = (...args: any[]) => any

/** Object that can be proxied */
type ProxyObject = object

/** Property access path as an array of property names/symbols */
type Path = (string | symbol)[]

/**
 * Operation performed on a proxy object
 * - 'set': A property was set to a new value
 * - 'delete': A property was deleted
 */
type Op =
  | [op: 'set', path: Path, value: unknown, prevValue: unknown]
  | [op: 'delete', path: Path, prevValue: unknown]

/** Function called when a proxy object changes */
type Listener = (op: Op | undefined, nextVersion: number) => void

export type INTERNAL_Op = Op

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
type AddListener = (listener: Listener) => RemoveListener

type ProxyState = readonly [
  target: object,
  ensureVersion: (nextCheckVersion?: number) => number,
  addListener: AddListener,
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
      // This is intentional to avoid copying with proxy-compare.
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

const createHandlerDefault = <T extends object>(
  isInitializing: () => boolean,
  addChildListener: (key: string | symbol, value: unknown) => void,
  removeChildListener: (key: string | symbol) => void,
  notifyUpdate: (op: Op | undefined) => void,
): ProxyHandler<T> => ({
  deleteProperty(target: T, key: string | symbol) {
    const prevValue = Reflect.get(target, key)
    removeChildListener(key)
    const deleted = Reflect.deleteProperty(target, key)
    if (deleted) {
      notifyUpdate(createOp?.('delete', key, prevValue))
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
    removeChildListener(key)
    if (isObject(value)) {
      value = getUntracked(value) || value
    }
    const nextValue =
      !proxyStateMap.has(value) && canProxy(value) ? proxy(value) : value
    addChildListener(key, nextValue)
    Reflect.set(target, key, nextValue, receiver)
    notifyUpdate(createOp?.('set', key, value, prevValue))
    return true
  },
})

const createOpDefault = (
  type: 'set' | 'delete',
  key: symbol | string,
  ...args: unknown[]
) => [type, [key], ...args] as Op

// internal states
const proxyStateMap: WeakMap<ProxyObject, ProxyState> = new WeakMap()
const refSet: WeakSet<object> = new WeakSet()
const snapCache: WeakMap<object, [version: number, snap: unknown]> =
  new WeakMap()
const versionHolder = [1] as [number]
const proxyCache: WeakMap<object, ProxyObject> = new WeakMap()

// notification delivery
type Subscription = {
  callback: (unstable_ops: Op[]) => void
  active: boolean
}
let batchDepth = 0
let isDelivering = false
let pendingSubscriptions = new Map<Subscription, Op[]>()

const deliver = (): unknown[] => {
  const errors: unknown[] = []
  isDelivering = true
  try {
    // Writes made by callbacks are queued for the next round, and delivered
    // together, so every subscription receives its ops in write order.
    while (pendingSubscriptions.size) {
      const round = pendingSubscriptions
      pendingSubscriptions = new Map()
      round.forEach((ops, subscription) => {
        if (subscription.active) {
          // Called as a plain function, so `this` isn't the subscription.
          const { callback } = subscription
          try {
            callback(ops)
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

// internal functions
let objectIs: (a: unknown, b: unknown) => boolean = Object.is
let newProxy = <T extends object>(target: T, handler: ProxyHandler<T>): T =>
  new Proxy(target, handler)
let canProxy: typeof canProxyDefault = canProxyDefault
let createSnapshot: typeof createSnapshotDefault = createSnapshotDefault
let createHandler: typeof createHandlerDefault = createHandlerDefault
let createOp: typeof createOpDefault | undefined

/**
 * Creates a reactive proxy object that can be tracked for changes
 */
export function proxy<T extends object>(baseObject: T = {} as T): T {
  if (!isObject(baseObject)) {
    throw new Error('object required')
  }
  const found = proxyCache.get(baseObject) as T | undefined
  if (found) {
    return found
  }
  let version = versionHolder[0]
  const listeners = new Set<Listener>()
  const notifyUpdate = (
    op: Op | undefined,
    nextVersion = ++versionHolder[0],
  ) => {
    if (version !== nextVersion) {
      checkVersion = version = nextVersion
      // Every write is delivered like a batch of one, so that all
      // subscriptions notified by it are queued before any callback runs.
      ++batchDepth
      try {
        listeners.forEach((listener) => listener(op, nextVersion))
      } finally {
        --batchDepth
      }
      reportErrors(deliverIfOutermost())
    }
  }
  let checkVersion = version
  const ensureVersion = (nextCheckVersion = versionHolder[0]) => {
    if (checkVersion !== nextCheckVersion) {
      checkVersion = nextCheckVersion
      childProxyStates.forEach(([childProxyState]) => {
        const childVersion = childProxyState[1](nextCheckVersion)
        if (childVersion > version) {
          version = childVersion
        }
      })
    }
    return version
  }
  const createChildListener =
    (key: string | symbol): Listener =>
    (op, nextVersion) => {
      let newOp: Op | undefined
      if (op) {
        newOp = [...op]
        newOp[1] = [key, ...(newOp[1] as Path)]
      }
      notifyUpdate(newOp, nextVersion)
    }
  const childProxyStates = new Map<
    string | symbol,
    readonly [ProxyState, RemoveListener?]
  >()
  const addChildListener = (key: string | symbol, value: unknown) => {
    const childProxyState =
      !refSet.has(value as object) && proxyStateMap.get(value as object)
    if (childProxyState) {
      if (process.env.NODE_ENV !== 'production' && childProxyStates.has(key)) {
        throw new Error('child listener already exists')
      }
      if (listeners.size) {
        const remove = childProxyState[2](createChildListener(key))
        childProxyStates.set(key, [childProxyState, remove])
      } else {
        childProxyStates.set(key, [childProxyState])
      }
    }
  }
  const removeChildListener = (key: string | symbol) => {
    const entry = childProxyStates.get(key)
    if (entry) {
      childProxyStates.delete(key)
      entry[1]?.()
    }
  }
  const addListener = (listener: Listener) => {
    listeners.add(listener)
    if (listeners.size === 1) {
      childProxyStates.forEach(([childProxyState, prevRemove], key) => {
        if (process.env.NODE_ENV !== 'production' && prevRemove) {
          throw new Error('remove already exists')
        }
        const remove = childProxyState[2](createChildListener(key))
        childProxyStates.set(key, [childProxyState, remove])
      })
    }
    const removeListener = () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        childProxyStates.forEach(([childProxyState, remove], key) => {
          if (remove) {
            remove()
            childProxyStates.set(key, [childProxyState])
          }
        })
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
  )
  const proxyObject = newProxy(baseObject, handler)
  proxyCache.set(baseObject, proxyObject)
  const proxyState: ProxyState = [baseObject, ensureVersion, addListener]
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
 * Gets the current version number of a proxy object
 */
export function getVersion(proxyObject: unknown): number | undefined {
  const proxyState = proxyStateMap.get(proxyObject as object)
  return proxyState?.[1]()
}

/**
 * Subscribes to changes in a proxy object
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
  callback: (unstable_ops: Op[]) => void,
): () => void {
  // eslint-disable-next-line prefer-rest-params
  if (typeof arguments[2] === 'boolean') {
    throw new Error(
      'notifyInSync has been removed. subscribe() is synchronous. Use batch() to group notifications.',
    )
  }
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (process.env.NODE_ENV !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const addListener = (proxyState as ProxyState)[2]
  const subscription: Subscription = { callback, active: false }
  const listener: Listener = (op) => {
    let ops = pendingSubscriptions.get(subscription)
    if (!ops) {
      ops = []
      pendingSubscriptions.set(subscription, ops)
    }
    if (op) {
      ops.push(op)
    }
  }
  const removeListener = addListener(listener)
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
 * subscription then runs once with the ops of all its writes, in order.
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

export function unstable_enableOp(
  enabled: boolean | typeof createOpDefault = true,
): void {
  if (enabled === true) {
    createOp = createOpDefault
  } else if (enabled === false) {
    createOp = undefined
  } else {
    createOp = enabled
  }
}

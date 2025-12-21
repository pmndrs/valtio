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
type NeedsOp = boolean
type AddListener = (listener: Listener, needsOp: NeedsOp) => RemoveListener

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
  return Object.preventExtensions(snap)
}

const createHandlerDefault = <T extends object>(
  isInitializing: () => boolean,
  addPropListener: (prop: string | symbol, propValue: unknown) => void,
  removePropListener: (prop: string | symbol) => void,
  notifyUpdate: (op: Op) => void,
): ProxyHandler<T> => ({
  deleteProperty(target: T, prop: string | symbol) {
    const prevValue = Reflect.get(target, prop)
    removePropListener(prop)
    const deleted = Reflect.deleteProperty(target, prop)
    if (deleted) {
      notifyUpdate(['delete', [prop], prevValue])
    }
    return deleted
  },
  set(target: T, prop: string | symbol, value: any, receiver: object) {
    const hasPrevValue = !isInitializing() && Reflect.has(target, prop)
    const prevValue = Reflect.get(target, prop, receiver)
    if (
      hasPrevValue &&
      (objectIs(prevValue, value) ||
        (proxyCache.has(value) && objectIs(prevValue, proxyCache.get(value))))
    ) {
      return true
    }
    removePropListener(prop)
    if (isObject(value)) {
      value = getUntracked(value) || value
    }
    const nextValue =
      !proxyStateMap.has(value) && canProxy(value) ? proxy(value) : value
    addPropListener(prop, nextValue)
    Reflect.set(target, prop, nextValue, receiver)
    notifyUpdate(['set', [prop], value, prevValue])
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
  const found = proxyCache.get(baseObject) as T | undefined
  if (found) {
    return found
  }
  let version = versionHolder[0]
  const listeners = new Set<Listener>()
  let opListeners = 0
  const notifyUpdate = (
    op: Op | undefined,
    nextVersion = ++versionHolder[0],
  ) => {
    if (version !== nextVersion) {
      checkVersion = version = nextVersion
      listeners.forEach((listener) => listener(op, nextVersion))
    }
  }
  let checkVersion = version
  const ensureVersion = (nextCheckVersion = versionHolder[0]) => {
    if (checkVersion !== nextCheckVersion) {
      checkVersion = nextCheckVersion
      propProxyStates.forEach(([propProxyState]) => {
        const propVersion = propProxyState[1](nextCheckVersion)
        if (propVersion > version) {
          version = propVersion
        }
      })
    }
    return version
  }
  const createPropListener =
    (prop: string | symbol): Listener =>
    (op, nextVersion) => {
      let newOp: Op | undefined
      if (op) {
        const newOp: Op = [...op]
        newOp[1] = [prop, ...(newOp[1] as Path)]
      }
      notifyUpdate(newOp, nextVersion)
    }
  type WithOp = boolean
  const propProxyStates = new Map<
    string | symbol,
    readonly [ProxyState, RemoveListener?, WithOp?]
  >()
  const addPropListenerWithOp = (
    prop: string | symbol,
    propProxyState: ProxyState,
    withOp: boolean,
  ) => {
    return propProxyState[2](createPropListener(prop), withOp)
  }
  const updatePropListeners = () => {
    const shouldListen = listeners.size > 0
    const withOp = opListeners > 0
    propProxyStates.forEach(
      ([propProxyState, prevRemove, prevWithOp], prop) => {
        if (!shouldListen) {
          if (prevRemove) {
            prevRemove()
            propProxyStates.set(prop, [propProxyState])
          }
          return
        }
        if (prevWithOp === withOp && prevRemove) {
          return
        }
        prevRemove?.()
        const remove = addPropListenerWithOp(prop, propProxyState, withOp)
        propProxyStates.set(prop, [propProxyState, remove, withOp])
      },
    )
  }
  const addPropListener = (prop: string | symbol, propValue: unknown) => {
    const propProxyState =
      !refSet.has(propValue as object) && proxyStateMap.get(propValue as object)
    if (propProxyState) {
      if (import.meta.env?.MODE !== 'production' && propProxyStates.has(prop)) {
        throw new Error('prop listener already exists')
      }
      if (listeners.size) {
        const withOp = opListeners > 0
        const remove = addPropListenerWithOp(prop, propProxyState, withOp)
        propProxyStates.set(prop, [propProxyState, remove, withOp])
      } else {
        propProxyStates.set(prop, [propProxyState])
      }
    }
  }
  const removePropListener = (prop: string | symbol) => {
    const entry = propProxyStates.get(prop)
    if (entry) {
      propProxyStates.delete(prop)
      entry[1]?.()
    }
  }
  const addListener = (listener: Listener, needsOp: NeedsOp) => {
    listeners.add(listener)
    if (needsOp) {
      opListeners += 1
    }
    if (listeners.size === 1 || (needsOp && opListeners === 1)) {
      updatePropListeners()
    }
    const removeListener = () => {
      listeners.delete(listener)
      if (needsOp) {
        opListeners -= 1
      }
      if (listeners.size === 0 || (needsOp && opListeners === 0)) {
        updatePropListeners()
      }
    }
    return removeListener
  }
  let initializing = true
  const handler = createHandler<T>(
    () => initializing,
    addPropListener,
    removePropListener,
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

/** @deprecated Use options object */
export function subscribe<T extends object>(
  proxyObject: T,
  callback: (unstable_ops: Op[]) => void,
  notifyInSync: boolean,
): () => void

export function subscribe<T extends object>(
  proxyObject: T,
  callback: (unstable_ops: Op[]) => void,
  options: { sync?: boolean; unstable_ops: true },
): () => void

export function subscribe<T extends object>(
  proxyObject: T,
  callback: () => void,
  options?: { sync?: boolean; unstable_ops?: false },
): () => void

/**
 * Subscribes to changes in a proxy object
 */
export function subscribe<T extends object>(
  proxyObject: T,
  callback: (unstable_ops: Op[]) => void,
  options?: { sync?: boolean; unstable_ops?: boolean } | boolean,
): () => void {
  if (typeof options === 'boolean') {
    console.warn(
      '[DEPRECATED] subscribe with boolean option is deprecated. Please use options object instead.',
    )
    options = { sync: options, unstable_ops: true }
  }
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (import.meta.env?.MODE !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  let promise: Promise<void> | undefined
  const ops: Op[] | undefined = options?.unstable_ops ? [] : undefined
  const addListener = (proxyState as ProxyState)[2]
  let isListenerActive = false
  const listener: Listener = (op) => {
    ops?.push(op!)
    if (options?.sync) {
      callback(ops?.splice(0) as never)
      return
    }
    if (!promise) {
      promise = Promise.resolve().then(() => {
        promise = undefined
        if (isListenerActive) {
          callback(ops?.splice(0) as never)
        }
      })
    }
  }
  const removeListener = addListener(listener, !!ops)
  isListenerActive = true
  return () => {
    isListenerActive = false
    removeListener()
  }
}

/**
 * Creates an immutable snapshot of the current state of a proxy object
 */
export function snapshot<T extends object>(proxyObject: T): Snapshot<T> {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (import.meta.env?.MODE !== 'production' && !proxyState) {
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
} {
  return {
    proxyStateMap,
    refSet,
    snapCache,
    versionHolder,
    proxyCache,
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

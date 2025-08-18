import { getUntracked } from 'proxy-compare'
import { markToTrack } from './react.ts'

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
type Listener = (op: Op, nextVersion: number) => void

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
 *
 * @template T - Type to convert to a snapshot
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
type AddPropListener = (
  prop: string | number | symbol,
  listener: Listener,
) => RemoveListener

type ProxyState = readonly [
  target: object,
  ensureVersion: (nextCheckVersion?: number) => number,
  addListener: AddListener,
  addPropListener: AddPropListener,
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
    const targetDesc = Reflect.getOwnPropertyDescriptor(
      target,
      key,
    ) as PropertyDescriptor
    const desc: PropertyDescriptor = {
      ...targetDesc,
      // This is intentional to avoid copying with proxy-compare.
      // It's still non-writable, so it avoids assigning a value.
      configurable: true,
    }
    // we call getter on render time to track props used inside getter
    if (desc.get || desc.set) {
      delete desc.writable
    } else {
      desc.writable = false
    }
    const value = desc.value
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
  if (
    Symbol.toStringTag in target &&
    (target[Symbol.toStringTag] === 'Set' ||
      target[Symbol.toStringTag] === 'Map')
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ;(target as any).size // touch property for registerSnapMap()
  }
  return Object.preventExtensions(snap)
}

const createHandlerDefault = <T extends object>(
  isInitializing: () => boolean,
  addPropStateListener: (prop: string | symbol, propValue: unknown) => void,
  removePropStateListener: (prop: string | symbol) => void,
  notifyUpdate: (op: Op) => void,
): ProxyHandler<T> => ({
  deleteProperty(target: T, prop: string | symbol) {
    const prevValue = Reflect.get(target, prop)
    removePropStateListener(prop)
    const deleted = Reflect.deleteProperty(target, prop)
    if (deleted) {
      notifyUpdate(['delete', [prop], prevValue])
    }
    return deleted
  },
  set(target: T, prop: string | symbol, value: any, receiver: object) {
    const hasPrevValue = !isInitializing() && Reflect.has(target, prop)
    const prevValue = Reflect.get(target, prop, receiver)
    const prevLen = Reflect.get(target, 'length', receiver)

    if (
      hasPrevValue &&
      (objectIs(prevValue, value) ||
        (proxyCache.has(value) && objectIs(prevValue, proxyCache.get(value))))
    ) {
      return true
    }
    removePropStateListener(prop)
    if (isObject(value)) {
      value = getUntracked(value) || value
    }
    const nextValue =
      !proxyStateMap.has(value) && canProxy(value) ? proxy(value) : value
    addPropStateListener(prop, nextValue)
    Reflect.set(target, prop, nextValue, receiver)
    notifyUpdate(['set', [prop], value, prevValue])

    const nextLen = Reflect.get(target, 'length', receiver)
    if (nextLen !== prevLen) {
      // we should notify length change here
      // because after target[prop] = value, length already changed
      // and next time trap setter for "length", prevValue always equal to value
      // we can't use Array.isArray to skip this logic, because Array.prototype.push support non-array objects:
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push#calling_push_on_non-array_objects
      notifyUpdate(['set', ['length'], nextLen, prevLen])
    }
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
 *
 * @template T - Type of the object to be proxied
 * @param {T} baseObject - The object to create a proxy for
 * @returns {T} A proxied version of the input object
 * @throws {Error} If the input is not an object
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
  const propListenersMap = new Map<string | number | symbol, Set<Listener>>()
  const notifyUpdate = (op: Op, nextVersion = ++versionHolder[0]) => {
    if (version !== nextVersion) {
      checkVersion = version = nextVersion
      listeners.forEach((listener) => listener(op, nextVersion))
      const prop = op[1][0]!
      const propListeners = propListenersMap.get(prop) ?? []
      for (const listener of propListeners) {
        listener(op, nextVersion)
      }
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
      const newOp: Op = [...op]
      newOp[1] = [prop, ...(newOp[1] as Path)]
      notifyUpdate(newOp, nextVersion)
    }
  const propProxyStates = new Map<
    string | symbol,
    readonly [ProxyState, RemoveListener?]
  >()
  const addPropStateListener = (prop: string | symbol, propValue: unknown) => {
    const propProxyState =
      !refSet.has(propValue as object) && proxyStateMap.get(propValue as object)
    if (propProxyState) {
      if (import.meta.env?.MODE !== 'production' && propProxyStates.has(prop)) {
        throw new Error('prop listener already exists')
      }
      if (listeners.size) {
        const remove = propProxyState[2](createPropListener(prop))
        propProxyStates.set(prop, [propProxyState, remove])
      } else {
        propProxyStates.set(prop, [propProxyState])
      }
    }
  }
  const removePropStateListener = (prop: string | symbol) => {
    const entry = propProxyStates.get(prop)
    if (entry) {
      propProxyStates.delete(prop)
      entry[1]?.()
    }
  }
  const addListener = (listener: Listener) => {
    listeners.add(listener)
    if (listeners.size === 1) {
      propProxyStates.forEach(([propProxyState, prevRemove], prop) => {
        if (import.meta.env?.MODE !== 'production' && prevRemove) {
          throw new Error('remove already exists')
        }
        const remove = propProxyState[2](createPropListener(prop))
        propProxyStates.set(prop, [propProxyState, remove])
      })
    }
    const removeListener = () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        propProxyStates.forEach(([propProxyState, remove], prop) => {
          if (remove) {
            remove()
            propProxyStates.set(prop, [propProxyState])
          }
        })
      }
    }
    return removeListener
  }
  const addPropListener = (
    prop: string | number | symbol,
    listener: Listener,
  ) => {
    let propListeners = propListenersMap.get(prop)
    if (!propListeners) {
      propListeners = new Set<Listener>()
      propListenersMap.set(prop, propListeners)
    }
    propListeners.add(listener)
    return () => {
      propListeners.delete(listener)
      if (propListeners.size === 0) {
        propListenersMap.delete(prop)
      }
    }
  }
  let initializing = true
  const handler = createHandler<T>(
    () => initializing,
    addPropStateListener,
    removePropStateListener,
    notifyUpdate,
  )
  const proxyObject = newProxy(baseObject, handler)
  proxyCache.set(baseObject, proxyObject)
  const proxyState: ProxyState = [
    baseObject,
    ensureVersion,
    addListener,
    addPropListener,
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
 * Gets the current version number of a proxy object
 *
 * @param {unknown} proxyObject - The proxy object to get the version of
 * @returns {number | undefined} The current version number, or undefined if not a proxy
 */
export function getVersion(proxyObject: unknown): number | undefined {
  const proxyState = proxyStateMap.get(proxyObject as object)
  return proxyState?.[1]()
}

/**
 * Subscribes to changes in a proxy object
 *
 * @template T - Type of the proxy object
 * @param {T} proxyObject - The proxy object to subscribe to
 * @param {Function} callback - Function called when the proxy object changes
 * @param {boolean} [notifyInSync] - If true, notifications happen synchronously
 * @returns {Function} Unsubscribe function to stop listening for changes
 */
export function subscribe<T extends object>(
  proxyObject: T,
  callback: (unstable_ops: Op[]) => void,
  notifyInSync?: boolean,
): () => void {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (import.meta.env?.MODE !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  let promise: Promise<void> | undefined
  const ops: Op[] = []
  const addListener = (proxyState as ProxyState)[2]
  let isListenerActive = false
  const listener: Listener = (op) => {
    ops.push(op)
    if (notifyInSync) {
      callback(ops.splice(0))
      return
    }
    if (!promise) {
      promise = Promise.resolve().then(() => {
        promise = undefined
        if (isListenerActive) {
          callback(ops.splice(0))
        }
      })
    }
  }
  const removeListener = addListener(listener)
  isListenerActive = true
  return () => {
    isListenerActive = false
    removeListener()
  }
}

/**
 * subscribeKey
 *
 * The subscribeKey utility enables subscription to a primitive subproperty of a given state proxy.
 * Subscriptions created with subscribeKey will only fire when the specified property changes.
 * notifyInSync: same as the parameter to subscribe(); true disables batching of subscriptions.
 *
 * @example
 * import { subscribeKey } from 'valtio/utils'
 * subscribeKey(state, 'count', (v) => console.log('state.count has changed to', v))
 */
export function subscribeKey<T extends object, K extends keyof T>(
  proxyObject: T,
  key: K,
  callback: (value: T[K]) => void,
  notifyInSync?: boolean,
): () => void {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (import.meta.env?.MODE !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  let promise: Promise<void> | undefined
  const ops: Op[] = []
  const addPropListener = (proxyState as ProxyState)[3]
  let isListenerActive = false
  const listener: Listener = (op) => {
    ops.push(op)
    if (notifyInSync) {
      callback(proxyObject[key])
      return
    }
    if (!promise) {
      promise = Promise.resolve().then(() => {
        promise = undefined
        if (isListenerActive) {
          callback(proxyObject[key])
        }
      })
    }
  }
  const removeListener = addPropListener(key, listener)
  isListenerActive = true
  return () => {
    isListenerActive = false
    removeListener()
  }
}

/**
 * Creates an immutable snapshot of the current state of a proxy object
 *
 * @template T - Type of the proxy object
 * @param {T} proxyObject - The proxy object to create a snapshot from
 * @returns {Snapshot<T>} An immutable snapshot of the current state
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
 *
 * @template T - Type of the object to mark as a reference
 * @param {T} obj - The object to mark as a reference
 * @returns {T & { $$valtioSnapshot: T }} The same object with a type marker
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

import { getUntracked, markToTrack } from 'proxy-compare'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

type AnyFunction = (...args: any[]) => any

type ProxyObject = object

type Path = (string | symbol)[]
type Op =
  | [op: 'set', path: Path, value: unknown, prevValue: unknown]
  | [op: 'delete', path: Path, prevValue: unknown]
type Listener = (op: Op, nextVersion: number) => void

type Primitive = string | number | boolean | null | undefined | symbol | bigint

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

const canProxyDefault = (x: unknown) =>
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
      desc.value = createSnapshot(target, ensureVersion()) as Snapshot<T>
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
const proxyStateMap = new WeakMap<ProxyObject, ProxyState>()
const refSet = new WeakSet()
const snapCache = new WeakMap<object, [version: number, snap: unknown]>()
const versionHolder = [1, 1] as [number, number]
const proxyCache = new WeakMap<object, ProxyObject>()

// internal functions
let objectIs = Object.is
let newProxy = <T extends object>(target: T, handler: ProxyHandler<T>): T =>
  new Proxy(target, handler)
let canProxy = canProxyDefault
let createSnapshot = createSnapshotDefault
let createHandler = createHandlerDefault

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
  const notifyUpdate = (op: Op, nextVersion = ++versionHolder[0]) => {
    if (version !== nextVersion) {
      version = nextVersion
      listeners.forEach((listener) => listener(op, nextVersion))
    }
  }
  let checkVersion = versionHolder[1]
  const ensureVersion = (nextCheckVersion = ++versionHolder[1]) => {
    if (checkVersion !== nextCheckVersion && !listeners.size) {
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
  const addPropListener = (prop: string | symbol, propValue: unknown) => {
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
  const removePropListener = (prop: string | symbol) => {
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

export function getVersion(proxyObject: unknown): number | undefined {
  const proxyState = proxyStateMap.get(proxyObject as object)
  return proxyState?.[1]()
}

export function subscribe<T extends object>(
  proxyObject: T,
  callback: (ops: Op[]) => void,
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

export function snapshot<T extends object>(proxyObject: T): Snapshot<T> {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (import.meta.env?.MODE !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const [target, ensureVersion] = proxyState as ProxyState
  return createSnapshot(target, ensureVersion()) as Snapshot<T>
}

export function ref<T extends object>(obj: T) {
  refSet.add(obj)
  return obj as T & { $$valtioSnapshot: T }
}

// ------------------------------------------------
// unstable APIs (subject to change without notice)
// ------------------------------------------------

export const unstable_getInternalStates = () => ({
  proxyStateMap,
  refSet,
  snapCache,
  versionHolder,
  proxyCache,
})

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

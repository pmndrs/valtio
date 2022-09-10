import { getUntracked, markToTrack } from 'proxy-compare'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

type AsRef = { $$valtioRef: true }

type ProxyObject = object

type Path = (string | symbol)[]
type Op =
  | [op: 'set', path: Path, value: unknown, prevValue: unknown]
  | [op: 'delete', path: Path, prevValue: unknown]
  | [op: 'resolve', path: Path, value: unknown]
  | [op: 'reject', path: Path, error: unknown]
type Listener = (op: Op, nextVersion: number) => void

type AnyFunction = (...args: any[]) => any

/**
 * This is not a public API.
 * It can be changed without any notice.
 */
export type INTERNAL_Snapshot<T> = T extends AnyFunction
  ? T
  : T extends AsRef
  ? T
  : T extends Promise<infer V>
  ? INTERNAL_Snapshot<V>
  : {
      readonly [K in keyof T]: INTERNAL_Snapshot<T[K]>
    }

type CreateSnapshot = <T extends object>(
  target: T,
  receiver: object,
  version: number,
  use?: <V>(promise: Promise<V>) => V
) => T

type ProxyState<T extends object> = [
  target: T,
  receiver: object,
  version: number,
  createSnapshot: CreateSnapshot,
  listeners: Set<Listener>
]

// shared state
const PROXY_STATE = __DEV__ ? Symbol('PROXY_STATE') : Symbol()
const refSet = new WeakSet()

const buildProxyFunction = (
  objectIs = Object.is,

  newProxy = <T extends object>(target: T, handler: ProxyHandler<T>): T =>
    new Proxy(target, handler),

  canProxy = (x: unknown) =>
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
    !(x instanceof ArrayBuffer),

  defaultUse = (() => {
    type PromiseState = { v?: unknown; e?: unknown }
    const PROMISE_STATE = Symbol()
    return <V>(promise: Promise<V>): V => {
      let state: PromiseState | undefined = (promise as any)[PROMISE_STATE]
      if (!state) {
        state = {}
        ;(promise as any)[PROMISE_STATE] = state
        promise
          .then((v) => {
            ;(state as PromiseState).v = v
            return v
          })
          .catch((e) => {
            ;(state as PromiseState).e = e
            throw e
          })
      }
      if ('v' in state) {
        return state.v as V
      }
      throw 'e' in state ? state.e : promise
    }
  })(),

  snapCache = new WeakMap<object, [version: number, snap: unknown]>(),

  createSnapshot: CreateSnapshot = <T extends object>(
    target: T,
    receiver: object,
    version: number,
    use = defaultUse
  ): T => {
    const cache = snapCache.get(receiver)
    if (cache?.[0] === version) {
      return cache[1] as T
    }
    const snap: any = Array.isArray(target)
      ? []
      : Object.create(Object.getPrototypeOf(target))
    markToTrack(snap, true) // mark to track
    snapCache.set(receiver, [version, snap])
    Reflect.ownKeys(target).forEach((key) => {
      const value = Reflect.get(target, key, receiver)
      if (refSet.has(value)) {
        markToTrack(value, false) // mark not to track
        snap[key] = value
      } else if (value instanceof Promise) {
        Object.defineProperty(snap, key, {
          get() {
            return use(value)
          },
        })
      } else if (value?.[PROXY_STATE]) {
        snap[key] = snapshot(value)
      } else {
        snap[key] = value
      }
    })
    return Object.freeze(snap)
  },

  proxyCache = new WeakMap<object, ProxyObject>(),

  versionHolder = [1] as [number],

  proxyFunction = <T extends object>(initialObject: T): T => {
    if (!isObject(initialObject)) {
      throw new Error('object required')
    }
    const found = proxyCache.get(initialObject) as T | undefined
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
    const propListeners = new Map<string | symbol, Listener>()
    const getPropListener = (prop: string | symbol) => {
      let propListener = propListeners.get(prop)
      if (!propListener) {
        propListener = (op, nextVersion) => {
          const newOp: Op = [...op]
          newOp[1] = [prop, ...(newOp[1] as Path)]
          notifyUpdate(newOp, nextVersion)
        }
        propListeners.set(prop, propListener)
      }
      return propListener
    }
    const popPropListener = (prop: string | symbol) => {
      const propListener = propListeners.get(prop)
      propListeners.delete(prop)
      return propListener
    }
    const baseObject = Array.isArray(initialObject)
      ? []
      : Object.create(Object.getPrototypeOf(initialObject))
    const handler: ProxyHandler<T> = {
      get(target: T, prop: string | symbol, receiver: object) {
        if (prop === PROXY_STATE) {
          const state: ProxyState<T> = [
            target,
            receiver,
            version,
            createSnapshot,
            listeners,
          ]
          return state
        }
        return Reflect.get(target, prop, receiver)
      },
      deleteProperty(target: T, prop: string | symbol) {
        const prevValue = Reflect.get(target, prop)
        const childListeners = (
          (prevValue as any)?.[PROXY_STATE] as ProxyState<object> | undefined
        )?.[4]
        if (childListeners) {
          childListeners.delete(popPropListener(prop) as Listener)
        }
        const deleted = Reflect.deleteProperty(target, prop)
        if (deleted) {
          notifyUpdate(['delete', [prop], prevValue])
        }
        return deleted
      },
      set(target: T, prop: string | symbol, value: any, receiver: object) {
        const hasPrevValue = Reflect.has(target, prop)
        const prevValue = Reflect.get(target, prop, receiver)
        if (hasPrevValue && objectIs(prevValue, value)) {
          return true
        }
        const childListeners = (
          (prevValue as any)?.[PROXY_STATE] as ProxyState<object> | undefined
        )?.[4]
        if (childListeners) {
          childListeners.delete(popPropListener(prop) as Listener)
        }
        if (isObject(value)) {
          value = getUntracked(value) || value
        }
        let nextValue: any
        if (Object.getOwnPropertyDescriptor(target, prop)?.set) {
          nextValue = value
        } else if (value instanceof Promise) {
          nextValue = value
            .then((v) => {
              notifyUpdate(['resolve', [prop], v])
              return v
            })
            .catch((e) => {
              notifyUpdate(['reject', [prop], e])
              throw e
            })
        } else if (value?.[PROXY_STATE]) {
          nextValue = value
          ;(nextValue[PROXY_STATE] as ProxyState<object>)[4].add(
            getPropListener(prop)
          )
        } else if (canProxy(value)) {
          nextValue = proxy(value)
          ;(nextValue[PROXY_STATE] as ProxyState<object>)[4].add(
            getPropListener(prop)
          )
        } else {
          nextValue = value
        }
        Reflect.set(target, prop, nextValue, receiver)
        notifyUpdate(['set', [prop], value, prevValue])
        return true
      },
    }
    const proxyObject = newProxy(baseObject, handler)
    proxyCache.set(initialObject, proxyObject)
    Reflect.ownKeys(initialObject).forEach((key) => {
      const desc = Object.getOwnPropertyDescriptor(
        initialObject,
        key
      ) as PropertyDescriptor
      if (desc.get || desc.set) {
        Object.defineProperty(baseObject, key, desc)
      } else {
        proxyObject[key as keyof T] = initialObject[key as keyof T]
      }
    })
    return proxyObject
  }
) =>
  [
    // public functions
    proxyFunction,
    // shared state
    PROXY_STATE,
    refSet,
    // internal things
    objectIs,
    newProxy,
    canProxy,
    defaultUse,
    snapCache,
    createSnapshot,
    proxyCache,
    versionHolder,
  ] as const

const [proxyFunction] = buildProxyFunction()

export function proxy<T extends object>(initialObject: T = {} as T): T {
  return proxyFunction(initialObject)
}

export function getVersion(proxyObject: unknown): number | undefined {
  const state: ProxyState<object> | undefined = (proxyObject as any)?.[
    PROXY_STATE
  ]
  return state?.[2]
}

export function subscribe<T extends object>(
  proxyObject: T,
  callback: (ops: Op[]) => void,
  notifyInSync?: boolean
) {
  if (__DEV__ && !(proxyObject as any)?.[PROXY_STATE]) {
    console.warn('Please use proxy object')
  }
  let promise: Promise<void> | undefined
  const ops: Op[] = []
  const listener: Listener = (op) => {
    ops.push(op)
    if (notifyInSync) {
      callback(ops.splice(0))
      return
    }
    if (!promise) {
      promise = Promise.resolve().then(() => {
        promise = undefined
        callback(ops.splice(0))
      })
    }
  }
  const listeners = ((proxyObject as any)[PROXY_STATE] as ProxyState<T>)[4]
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function snapshot<T extends object>(
  proxyObject: T,
  use?: <V>(promise: Promise<V>) => V
): INTERNAL_Snapshot<T> {
  if (__DEV__ && !(proxyObject as any)?.[PROXY_STATE]) {
    console.warn('Please use proxy object')
  }
  const [target, receiver, version, createSnapshot] = (proxyObject as any)[
    PROXY_STATE
  ] as ProxyState<T>
  return createSnapshot(target, receiver, version, use) as INTERNAL_Snapshot<T>
}

export function ref<T extends object>(obj: T): T & AsRef {
  refSet.add(obj)
  return obj as T & AsRef
}

export const unstable_buildProxyFunction = buildProxyFunction

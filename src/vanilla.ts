import { getUntracked, markToTrack } from 'proxy-compare'

const VERSION = Symbol()
const LISTENERS = Symbol()
const SNAPSHOT = Symbol()
const HANDLER = Symbol()
const PROMISE_RESULT = Symbol()
const PROMISE_ERROR = Symbol()

type AsRef = { $$valtioRef: true }
const refSet = new WeakSet()
export function ref<T extends object>(o: T): T & AsRef {
  refSet.add(o)
  return o as T & AsRef
}

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

const canProxy = (x: unknown) =>
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
  !(x instanceof ArrayBuffer)

type ProxyObject = object
const proxyCache = new WeakMap<object, ProxyObject>()

type Path = (string | symbol)[]
type Op =
  | [op: 'set', path: Path, value: unknown, prevValue: unknown]
  | [op: 'delete', path: Path, prevValue: unknown]
  | [op: 'resolve', path: Path, value: unknown]
  | [op: 'reject', path: Path, error: unknown]
type Listener = (op: Op, nextVersion: number) => void

let globalVersion = 1
const snapshotCache = new WeakMap<
  object,
  [version: number, snapshot: unknown]
>()

export function proxy<T extends object>(initialObject: T = {} as T): T {
  if (!isObject(initialObject)) {
    throw new Error('object required')
  }
  const found = proxyCache.get(initialObject) as T | undefined
  if (found) {
    return found
  }
  let version = globalVersion
  const listeners = new Set<Listener>()
  const notifyUpdate = (op: Op, nextVersion = ++globalVersion) => {
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
  const createSnapshot = (target: T, receiver: any) => {
    const cache = snapshotCache.get(receiver)
    if (cache?.[0] === version) {
      return cache[1]
    }
    const snapshot: any = Array.isArray(target)
      ? []
      : Object.create(Object.getPrototypeOf(target))
    markToTrack(snapshot, true) // mark to track
    snapshotCache.set(receiver, [version, snapshot])
    Reflect.ownKeys(target).forEach((key) => {
      const value = Reflect.get(target, key, receiver)
      if (refSet.has(value)) {
        markToTrack(value, false) // mark not to track
        snapshot[key] = value
      } else if (value instanceof Promise) {
        if (PROMISE_RESULT in value) {
          snapshot[key] = (value as any)[PROMISE_RESULT]
        } else {
          const errorOrPromise = (value as any)[PROMISE_ERROR] || value
          Object.defineProperty(snapshot, key, {
            get() {
              if (PROMISE_RESULT in value) {
                return (value as any)[PROMISE_RESULT]
              }
              throw errorOrPromise
            },
          })
        }
      } else if (value?.[LISTENERS]) {
        snapshot[key] = value[SNAPSHOT]
      } else {
        snapshot[key] = value
      }
    })
    Object.freeze(snapshot)
    return snapshot
  }
  const baseObject = Array.isArray(initialObject)
    ? []
    : Object.create(Object.getPrototypeOf(initialObject))
  const handler = {
    get(target: T, prop: string | symbol, receiver: any) {
      if (prop === VERSION) {
        return version
      }
      if (prop === LISTENERS) {
        return listeners
      }
      if (prop === SNAPSHOT) {
        return createSnapshot(target, receiver)
      }
      if (prop === HANDLER) {
        return handler
      }
      return Reflect.get(target, prop, receiver)
    },
    deleteProperty(target: T, prop: string | symbol) {
      const prevValue = Reflect.get(target, prop)
      const childListeners = prevValue?.[LISTENERS]
      if (childListeners) {
        childListeners.delete(popPropListener(prop))
      }
      const deleted = Reflect.deleteProperty(target, prop)
      if (deleted) {
        notifyUpdate(['delete', [prop], prevValue])
      }
      return deleted
    },
    is: Object.is,
    canProxy,
    set(target: T, prop: string | symbol, value: any, receiver: any) {
      const prevValue = Reflect.get(target, prop, receiver)
      if (this.is(prevValue, value)) {
        return true
      }
      const childListeners = prevValue?.[LISTENERS]
      if (childListeners) {
        childListeners.delete(popPropListener(prop))
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
            nextValue[PROMISE_RESULT] = v
            notifyUpdate(['resolve', [prop], v])
            return v
          })
          .catch((e) => {
            nextValue[PROMISE_ERROR] = e
            notifyUpdate(['reject', [prop], e])
          })
      } else if (value?.[LISTENERS]) {
        nextValue = value
        nextValue[LISTENERS].add(getPropListener(prop))
      } else if (this.canProxy(value)) {
        nextValue = proxy(value)
        nextValue[LISTENERS].add(getPropListener(prop))
      } else {
        nextValue = value
      }
      Reflect.set(target, prop, nextValue, receiver)
      notifyUpdate(['set', [prop], value, prevValue])
      return true
    },
  }
  const proxyObject = new Proxy(baseObject, handler)
  proxyCache.set(initialObject, proxyObject)
  Reflect.ownKeys(initialObject).forEach((key) => {
    const desc = Object.getOwnPropertyDescriptor(
      initialObject,
      key
    ) as PropertyDescriptor
    if (desc.get || desc.set) {
      Object.defineProperty(baseObject, key, desc)
    } else {
      proxyObject[key] = initialObject[key as keyof T]
    }
  })
  return proxyObject
}

export function getVersion(proxyObject: unknown): number | undefined {
  return isObject(proxyObject) ? (proxyObject as any)[VERSION] : undefined
}

export function subscribe<T extends object>(
  proxyObject: T,
  callback: (ops: Op[]) => void,
  notifyInSync?: boolean
) {
  if (__DEV__ && !(proxyObject as any)?.[LISTENERS]) {
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
  ;(proxyObject as any)[LISTENERS].add(listener)
  return () => {
    ;(proxyObject as any)[LISTENERS].delete(listener)
  }
}

type AnyFunction = (...args: any[]) => any
export type Snapshot<T> = T extends AnyFunction
  ? T
  : T extends AsRef
  ? T
  : T extends Promise<infer V>
  ? Snapshot<V>
  : {
      readonly [K in keyof T]: Snapshot<T[K]>
    }

export function snapshot<T extends object>(proxyObject: T): Snapshot<T> {
  if (__DEV__ && !(proxyObject as any)?.[SNAPSHOT]) {
    console.warn('Please use proxy object')
  }
  return (proxyObject as any)[SNAPSHOT]
}

export function getHandler<T extends object>(proxyObject: T) {
  if (__DEV__ && !(proxyObject as any)?.[HANDLER]) {
    console.warn('Please use proxy object')
  }
  return (proxyObject as any)[HANDLER]
}

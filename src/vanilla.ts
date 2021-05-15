import { getUntracked, markToTrack } from 'proxy-compare'

const VERSION = Symbol()
const LISTENERS = Symbol()
const SNAPSHOT = Symbol()
const PROMISE_RESULT = Symbol()
const PROMISE_ERROR = Symbol()

const enum AsRef {}
const refSet = new WeakSet()
export const ref = <T extends object>(o: T): T & AsRef => {
  refSet.add(o)
  return o as T & AsRef
}

const isSupportedObject = (x: unknown): x is object =>
  typeof x === 'object' &&
  x !== null &&
  (Array.isArray(x) || !(x as any)[Symbol.iterator]) &&
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

let globalVersion = 1
const snapshotCache = new WeakMap<
  object,
  {
    version: number
    snapshot: unknown
  }
>()

export const proxy = <T extends object>(initialObject: T = {} as T): T => {
  if (!isSupportedObject(initialObject)) {
    throw new Error('unsupported object type')
  }
  if (proxyCache.has(initialObject)) {
    return proxyCache.get(initialObject) as T
  }
  let version = globalVersion
  const listeners = new Set<(nextVersion: number) => void>()
  const notifyUpdate = (nextVersion?: number) => {
    if (!nextVersion) {
      nextVersion = ++globalVersion
    }
    if (version !== nextVersion) {
      version = nextVersion
      listeners.forEach((listener) => listener(nextVersion as number))
    }
  }
  const createSnapshot = (target: any, receiver: any) => {
    const cache = snapshotCache.get(receiver)
    if (cache && cache.version === version) {
      return cache.snapshot
    }
    const snapshot: any = Array.isArray(target)
      ? []
      : Object.create(Object.getPrototypeOf(target))
    markToTrack(snapshot, true) // mark to track
    snapshotCache.set(receiver, { version, snapshot })
    Reflect.ownKeys(target).forEach((key) => {
      const value = target[key]
      if (refSet.has(value)) {
        markToTrack(value, false) // mark not to track
        snapshot[key] = value
      } else if (!isSupportedObject(value)) {
        snapshot[key] = value
      } else if (value instanceof Promise) {
        if (PROMISE_RESULT in (value as any)) {
          snapshot[key] = (value as any)[PROMISE_RESULT]
        } else {
          const errorOrPromise = (value as any)[PROMISE_ERROR] || value
          Object.defineProperty(snapshot, key, {
            get() {
              throw errorOrPromise
            },
          })
        }
      } else if ((value as any)[VERSION]) {
        snapshot[key] = (value as any)[SNAPSHOT]
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
  const proxyObject = new Proxy(baseObject, {
    get(target, prop, receiver) {
      if (prop === VERSION) {
        return version
      }
      if (prop === LISTENERS) {
        return listeners
      }
      if (prop === SNAPSHOT) {
        return createSnapshot(target, receiver)
      }
      return target[prop]
    },
    deleteProperty(target, prop) {
      const prevValue = target[prop]
      const childListeners = prevValue && (prevValue as any)[LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      const deleted = Reflect.deleteProperty(target, prop)
      if (deleted) {
        notifyUpdate()
      }
      return deleted
    },
    set(target, prop, value) {
      const prevValue = target[prop]
      if (Object.is(prevValue, value)) {
        return true
      }
      const childListeners = prevValue && (prevValue as any)[LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      if (
        refSet.has(value) ||
        !isSupportedObject(value) ||
        Object.getOwnPropertyDescriptor(target, prop)?.set
      ) {
        target[prop] = value
      } else if (value instanceof Promise) {
        target[prop] = value
          .then((v) => {
            target[prop][PROMISE_RESULT] = v
            notifyUpdate()
            return v
          })
          .catch((e) => {
            target[prop][PROMISE_ERROR] = e
            notifyUpdate()
          })
      } else {
        value = getUntracked(value) || value
        if (value[LISTENERS]) {
          target[prop] = value
        } else {
          target[prop] = proxy(value)
        }
        target[prop][LISTENERS].add(notifyUpdate)
      }
      notifyUpdate()
      return true
    },
  })
  proxyCache.set(initialObject, proxyObject)
  Reflect.ownKeys(initialObject).forEach((key) => {
    const desc = Object.getOwnPropertyDescriptor(
      initialObject,
      key
    ) as PropertyDescriptor
    if (desc.get || desc.set) {
      Object.defineProperty(baseObject, key, desc)
    } else {
      proxyObject[key] = (initialObject as any)[key]
    }
  })
  return proxyObject
}

export const getVersion = (proxyObject: any): number => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!proxyObject || !proxyObject[VERSION])
  ) {
    throw new Error('Please use proxy object')
  }
  return proxyObject[VERSION]
}

export const subscribe = (
  proxyObject: any,
  callback: () => void,
  notifyInSync?: boolean
) => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!proxyObject || !proxyObject[LISTENERS])
  ) {
    throw new Error('Please use proxy object')
  }
  let pendingVersion = 0
  const listener = (nextVersion: number) => {
    if (notifyInSync) {
      callback()
      return
    }
    pendingVersion = nextVersion
    Promise.resolve().then(() => {
      if (nextVersion === pendingVersion) {
        callback()
      }
    })
  }
  proxyObject[LISTENERS].add(listener)
  return () => {
    proxyObject[LISTENERS].delete(listener)
  }
}

export type DeepResolveType<T> = T extends Function
  ? T
  : T extends AsRef
  ? T
  : T extends Promise<infer V>
  ? V
  : T extends object
  ? {
      [K in keyof T]: DeepResolveType<T[K]>
    }
  : T

export const snapshot = <T extends object>(
  proxyObject: T
): DeepResolveType<T> => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!proxyObject || !(proxyObject as any)[SNAPSHOT])
  ) {
    throw new Error('Please use proxy object')
  }
  return (proxyObject as any)[SNAPSHOT]
}

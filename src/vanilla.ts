import { getUntrackedObject, markToTrack } from 'proxy-compare'

const VERSION = Symbol()
const LISTENERS = Symbol()
const SNAPSHOT = Symbol()

const isSupportedObject = (x: unknown): x is object =>
  typeof x === 'object' &&
  x !== null &&
  (Array.isArray(x) || !(x as any)[Symbol.iterator]) &&
  !(x instanceof WeakMap) &&
  !(x instanceof WeakSet) &&
  !(x instanceof Error) &&
  !(x instanceof Number) &&
  !(x instanceof BigInt) &&
  !(x instanceof Date) &&
  !(x instanceof String) &&
  !(x instanceof RegExp) &&
  !(x instanceof ArrayBuffer)

const proxyCache = new WeakMap<object, object>()
let globalVersion = 0
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
  const emptyCopy = Array.isArray(initialObject)
    ? []
    : Object.create(Object.getPrototypeOf(initialObject))
  const p = new Proxy(emptyCopy, {
    get(target, prop, receiver) {
      if (prop === VERSION) {
        return version
      }
      if (prop === LISTENERS) {
        return listeners
      }
      if (prop === SNAPSHOT) {
        const cache = snapshotCache.get(receiver)
        if (cache && cache.version === version) {
          return cache.snapshot
        }
        const snapshot: any = Array.isArray(target)
          ? []
          : Object.create(Object.getPrototypeOf(target))
        markToTrack(snapshot)
        snapshotCache.set(receiver, { version, snapshot })
        Reflect.ownKeys(target).forEach((key) => {
          const value = target[key]
          if (!isSupportedObject(value)) {
            snapshot[key] = value
          } else if (value instanceof Promise) {
            Object.defineProperty(snapshot, key, {
              get() {
                throw value
              },
            })
          } else {
            snapshot[key] = (value as any)[SNAPSHOT]
          }
        })
        if (
          typeof process === 'object' &&
          process.env.NODE_ENV !== 'production'
        ) {
          Object.freeze(snapshot)
        }
        return snapshot
      }
      return target[prop]
    },
    deleteProperty(target, prop) {
      const prevValue = target[prop]
      const childListeners =
        isSupportedObject(prevValue) && (prevValue as any)[LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      const deleted = Reflect.deleteProperty(target, prop)
      if (deleted) {
        notifyUpdate()
      }
      return deleted
    },
    set(target, prop, value, receiver) {
      const prevValue = target[prop]
      if (Object.is(prevValue, value)) {
        return true
      }
      const childListeners =
        isSupportedObject(prevValue) && (prevValue as any)[LISTENERS]
      if (childListeners) {
        childListeners.delete(notifyUpdate)
      }
      if (!isSupportedObject(value)) {
        target[prop] = value
      } else if (value instanceof Promise) {
        target[prop] = value.then((v) => {
          receiver[prop] = v
        })
      } else {
        value = getUntrackedObject(value) || value
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
  proxyCache.set(initialObject, p)
  Reflect.ownKeys(initialObject).forEach((key) => {
    p[key] = (initialObject as any)[key]
  })
  return p
}

export const getVersion = (p: any): number => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!p || !p[VERSION])
  ) {
    throw new Error('Please use proxy object')
  }
  return p[VERSION]
}

export const subscribe = (p: any, callback: () => void) => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!p || !p[LISTENERS])
  ) {
    throw new Error('Please use proxy object')
  }
  let pendingVersion = 0
  const listener = (nextVersion: number) => {
    pendingVersion = nextVersion
    Promise.resolve().then(() => {
      if (nextVersion === pendingVersion) {
        callback()
      }
    })
  }
  p[LISTENERS].add(listener)
  return () => {
    p[LISTENERS].delete(listener)
  }
}

export const snapshot = <T extends object>(p: T): T => {
  if (
    typeof process === 'object' &&
    process.env.NODE_ENV !== 'production' &&
    (!p || !(p as any)[SNAPSHOT])
  ) {
    throw new Error('Please use proxy object')
  }
  return (p as any)[SNAPSHOT]
}

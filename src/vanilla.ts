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

// shared state
const refSet = new WeakSet()
const VERSION = __DEV__ ? Symbol('VERSION') : Symbol()
const LISTENERS = __DEV__ ? Symbol('LISTENERS') : Symbol()
const SNAPSHOT = __DEV__ ? Symbol('SNAPSHOT') : Symbol()

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

  PROMISE_RESULT = __DEV__ ? Symbol('PROMISE_RESULT') : Symbol(),
  PROMISE_ERROR = __DEV__ ? Symbol('PROMISE_ERROR') : Symbol(),

  snapshotCache = new WeakMap<object, [version: number, snapshot: unknown]>(),

  createSnapshot = <T extends object>(
    version: number,
    target: T,
    receiver: any
  ): T => {
    const cache = snapshotCache.get(receiver)
    if (cache?.[0] === version) {
      return cache[1] as T
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
    return Object.freeze(snapshot)
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
      get(target: T, prop: string | symbol, receiver: any) {
        if (prop === VERSION) {
          return version
        }
        if (prop === LISTENERS) {
          return listeners
        }
        if (prop === SNAPSHOT) {
          return createSnapshot(version, target, receiver)
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
      set(target: T, prop: string | symbol, value: any, receiver: any) {
        const hasPrevValue = Reflect.has(target, prop)
        const prevValue = Reflect.get(target, prop, receiver)
        if (hasPrevValue && objectIs(prevValue, value)) {
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
        } else if (canProxy(value)) {
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
    refSet,
    VERSION,
    LISTENERS,
    SNAPSHOT,
    // internal things
    objectIs,
    newProxy,
    canProxy,
    PROMISE_RESULT,
    PROMISE_ERROR,
    snapshotCache,
    createSnapshot,
    proxyCache,
    versionHolder,
  ] as const

const [proxyFunction] = buildProxyFunction()

export function proxy<T extends object>(initialObject: T = {} as T): T {
  return proxyFunction(initialObject)
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
        if ((proxyObject as any)[LISTENERS].has(listener)) {
          callback(ops.splice(0))
        }
      })
    }
  }
  ;(proxyObject as any)[LISTENERS].add(listener)
  return () => {
    ;(proxyObject as any)[LISTENERS].delete(listener)
  }
}

export function snapshot<T extends object>(
  proxyObject: T
): INTERNAL_Snapshot<T> {
  if (__DEV__ && !(proxyObject as any)?.[SNAPSHOT]) {
    console.warn('Please use proxy object')
  }
  return (proxyObject as any)[SNAPSHOT]
}

export function ref<T extends object>(obj: T): T & AsRef {
  refSet.add(obj)
  return obj as T & AsRef
}

export const unstable_buildProxyFunction = buildProxyFunction

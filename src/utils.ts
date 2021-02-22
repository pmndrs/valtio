import { useRef } from 'react'
import { proxy, useProxy, subscribe, snapshot } from 'valtio'
import { createDeepProxy, isDeepChanged } from 'proxy-compare'
import type { NonPromise } from './vanilla'

/**
 * useLocalProxy
 *
 * This is to create a proxy in a component at mount.
 * and discard it when the component unmounts.
 * It returns a tuple of snapshot and state.
 *
 * [Notes]
 * Valtio is designed for module state and this use case for component states
 * is not a primary target. It might not be ideal for such use cases.
 * For component state, alternatively consider using
 * [useImmer](https://github.com/immerjs/use-immer).
 */
export const useLocalProxy = <T extends object>(init: T | (() => T)) => {
  const ref = useRef<T>()
  if (!ref.current) {
    const initialObject =
      typeof init === 'function' ? (init as () => T)() : init
    ref.current = proxy(initialObject)
  }
  return [useProxy(ref.current), ref.current] as const
}

/**
 * subscribeKey
 *
 * The subscribeKey utility enables subscription to a primitive subproperty of a given state proxy.
 * Subscriptions created with subscribeKey will only fire when the specified property changes.
 *
 * @example
 * import { subscribeKey } from 'valtio/utils'
 * subscribeKey(state, 'count', (v) => console.log('state.count has changed to', v))
 */
export const subscribeKey = <T extends object>(
  proxyObject: T,
  key: keyof T,
  callback: (value: T[typeof key]) => void
) => {
  let prevValue = proxyObject[key]
  return subscribe(proxyObject, () => {
    const nextValue = proxyObject[key]
    if (!Object.is(prevValue, nextValue)) {
      callback((prevValue = nextValue))
    }
  })
}

/**
 * devtools
 *
 * This is to connect with [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension).
 * Limitation: Only plain objects/values are supported.
 *
 * @example
 * import { devtools } from 'valtio/utils'
 * const state = proxy({ count: 0, text: 'hello' })
 * const unsub = devtools(state, 'state name')
 */
export const devtools = <T extends object>(proxyObject: T, name?: string) => {
  let extension: any
  try {
    extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__
  } catch {}
  if (!extension) {
    if (
      typeof process === 'object' &&
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      console.warn('[Warning] Please install/enable Redux devtools extension')
    }
    return
  }

  let isTimeTraveling = false
  const devtools = extension.connect({ name })
  const unsub1 = subscribe(proxyObject, () => {
    if (isTimeTraveling) {
      isTimeTraveling = false
    } else {
      devtools.send(
        `Update - ${new Date().toLocaleString()}`,
        snapshot(proxyObject)
      )
    }
  })
  const unsub2 = devtools.subscribe(
    (message: { type: string; payload?: any; state?: any }) => {
      if (message.type === 'DISPATCH' && message.state) {
        if (
          message.payload?.type === 'JUMP_TO_ACTION' ||
          message.payload?.type === 'JUMP_TO_STATE'
        ) {
          isTimeTraveling = true
        }
        const nextValue = JSON.parse(message.state)
        Object.keys(nextValue).forEach((key) => {
          ;(proxyObject as any)[key] = nextValue[key]
        })
      } else if (
        message.type === 'DISPATCH' &&
        message.payload?.type === 'COMMIT'
      ) {
        devtools.init(snapshot(proxyObject))
      }
    }
  )
  devtools.init(snapshot(proxyObject))
  return () => {
    unsub1()
    unsub2()
  }
}

/**
 * addComputed
 *
 * This is hard to type nicely.
 */
export const addComputed = <T extends object, U>(
  proxyObject: T,
  key: string | string[],
  get: (snap: NonPromise<T>) => U,
  set?: (state: T, newValue: U) => void,
  targetObject = proxyObject
) => {
  const [firstKey, ...restKeys] = Array.isArray(key) ? key : [key]
  if (restKeys.length) {
    if (
      firstKey in targetObject &&
      typeof (targetObject as any)[firstKey] !== 'object'
    ) {
      throw new Error('object property is not an object')
    }
    ;(targetObject as any)[firstKey] = addComputed(
      proxyObject,
      restKeys,
      get,
      set,
      (targetObject as any)[firstKey] || proxy({})
    )
    return targetObject
  }
  if (firstKey in targetObject) {
    throw new Error('object property already defined')
  }
  let computedValue: U
  let prevSnapshot: NonPromise<T> | undefined
  let affected = new WeakMap()
  Object.defineProperty(targetObject, firstKey, {
    get() {
      const nextSnapshot = snapshot(proxyObject)
      if (
        !prevSnapshot ||
        isDeepChanged(prevSnapshot, nextSnapshot, affected)
      ) {
        affected = new WeakMap()
        computedValue = get(createDeepProxy(nextSnapshot, affected))
        prevSnapshot = nextSnapshot
      }
      return computedValue
    },
    set(v) {
      set?.(proxyObject, v)
    },
  })
  const derivedObject = proxy(targetObject)
  /*
  subscribe(
    targetObject,
    () => {
      Object.entries(targetObject).forEach(([k, v]) => {
        ;(derivedObject as any)[k] = v
      })
    },
    true
  )
  */
  subscribe(
    derivedObject,
    () => {
      Object.entries(derivedObject).forEach(([k, v]) => {
        if (k !== firstKey) {
          ;(targetObject as any)[k] = v
        }
      })
    },
    true
  )
  return derivedObject
}

export const proxyWithComputed = <T extends object, U extends object>(
  initialObject: T,
  computedFns: ComputedFns<T, U>
): T & U => {
  const isComputedFn = <T extends object, UU>(
    item: ComputedFn<T, UU> | (UU extends object ? ComputedFns<T, UU> : never)
  ): item is ComputedFn<T, UU> => typeof item === 'function' || 'get' in item

  let proxyObject = proxy(initialObject) as T & U
  const walk = <UU extends object>(path: string[], fns: ComputedFns<T, UU>) => {
    ;(Object.keys(fns) as (keyof typeof fns)[]).forEach((key) => {
      const item = fns[key]
      const newPath = [...path, key as string]
      if (!isComputedFn(item)) {
        walk(newPath, item as ComputedFns<T, object>)
        return
      }
      const { get, set } = (typeof item === 'function'
        ? { get: item }
        : item) as {
        get: (snap: NonPromise<T>) => UU[typeof key]
        set?: (state: T, newValue: UU[typeof key]) => void
      }
      proxyObject = addComputed(proxyObject, newPath, get, set)
    })
  }
  walk([], computedFns)

  return proxyObject
}
/**
 * proxyWithComputed
 *
 * This is to create a proxy with initial object and additional object,
 * which specifies getters for computed values with dependency tracking.
 * It also accepts optional setters for computed values.
 *
 * [Notes]
 * This is for expert users and not recommended for ordinary users.
 * Contradictory to its name, this is costly and overlaps with useProxy.
 * Do not try to optimize too early. It can worsen the performance.
 * Measurement and comparison will be very important.
 *
 * @example
 * import { proxyWithComputed } from 'valtio/utils'
 * const state = proxyWithComputed({
 *   count: 1,
 * }, {
 *   doubled: snap => snap.count * 2, // getter only
 *   tripled: {
 *     get: snap => snap.count * 3,
 *     set: (state, newValue) => { state.count = newValue / 3 }
 *   }, // with optional setter
 * })
 */
export const proxyWithComputedOrig = <T extends object, U extends object>(
  initialObject: T,
  computedFns: ComputedFns<T, U>
) => {
  const isComputedFn = <T extends object, UU>(
    item: ComputedFn<T, UU> | (UU extends object ? ComputedFns<T, UU> : never)
  ): item is ComputedFn<T, UU> => typeof item === 'function' || 'get' in item
  const COMPUTED_ERROR = Symbol()
  const NOTIFIER = Symbol()
  const COMPUTE = Symbol()
  const pending: ((snap: NonPromise<T & U>) => void)[] = []

  const walk = <UU extends object>(
    path: string[],
    obj: object,
    fns: ComputedFns<T, UU>
  ) => {
    Object.defineProperty(obj, NOTIFIER, { value: 0 })
    const notify = () => {
      let tmpProxy = proxyObject
      let tmpPath = path
      while (tmpPath.length > 0) {
        const [first, ...rest] = tmpPath
        tmpProxy = (tmpProxy as any)[first]
        tmpPath = rest
      }
      ++(tmpProxy as any)[NOTIFIER]
    }
    const fnsKeys = Object.keys(fns) as (keyof typeof fns)[]
    fnsKeys.forEach((key, index) => {
      const isLastItem = index === fnsKeys.length - 1
      const item = fns[key]
      if (!isComputedFn(item)) {
        const subObj = obj[key as keyof typeof obj]
        if (typeof subObj === 'object' && typeof item === 'object') {
          walk([...path, key as string], subObj, item as ComputedFns<T, object>)
        }
        return
      }
      const { get, set } = (typeof item === 'function'
        ? { get: item }
        : item) as {
        get: (snap: NonPromise<T>) => UU[typeof key]
        set?: (state: T, newValue: UU[typeof key]) => void
      }
      let computedValue: UU[typeof key]
      let prevSnapshot: NonPromise<T> | undefined
      let affected = new WeakMap()
      const desc: PropertyDescriptor = {}
      desc.get = () => {
        pending.push((snap) => {
          if (!prevSnapshot || isDeepChanged(prevSnapshot, snap, affected)) {
            affected = new WeakMap()
            computedValue = get(createDeepProxy(snap, affected))
            if (computedValue instanceof Promise) {
              computedValue
                .then((v) => {
                  computedValue = v
                  notify()
                })
                .catch((e) => {
                  ;(computedValue as any) = {
                    [COMPUTED_ERROR]: e,
                  }
                  notify()
                })
            }
            prevSnapshot = snap
            let tmpSnap = snap
            let tmpPath = path
            while (tmpPath.length > 0) {
              const [first, ...rest] = tmpPath
              tmpSnap = (tmpSnap as any)[first]
              tmpPath = rest
            }
            if (computedValue instanceof Promise) {
              Object.defineProperty(tmpSnap, key, {
                get() {
                  throw computedValue
                },
              })
            } else if (
              computedValue &&
              (computedValue as any)[COMPUTED_ERROR]
            ) {
              Object.defineProperty(tmpSnap, key, {
                get() {
                  throw (computedValue as any)[COMPUTED_ERROR]
                },
              })
            } else {
              ;(tmpSnap as any)[key] = computedValue
            }
            if (isLastItem && tmpSnap !== snap) {
              Object.freeze(tmpSnap)
            }
          }
        })
        return computedValue
      }
      if (set) {
        desc.set = (newValue) => set(proxyObject, newValue)
      }
      if (Object.getOwnPropertyDescriptor(obj, key)) {
        throw new Error('object property already defined')
      }
      Object.defineProperty(obj, key, desc)
    })
  }
  walk([], initialObject, computedFns)

  Object.defineProperty(initialObject, COMPUTE, {
    get() {
      const snap = snapshot(proxyObject)
      while (pending.length) {
        pending.shift()?.(snap)
      }
    },
  })
  const proxyObject = proxy(initialObject) as T & U
  subscribe(
    proxyObject,
    () => {
      const snap = snapshot(proxyObject)
      Object.freeze(snap)
    },
    true
  )
  return proxyObject
}

type ComputedFn<T extends object, UU> =
  | ((snap: NonPromise<T>) => UU)
  | {
      get: (snap: NonPromise<T>) => UU
      set?: (state: T, newValue: UU) => void
    }

type ComputedFns<T extends object, U extends object> = {
  [K in keyof U]:
    | ComputedFn<T, U[K]>
    | (U[K] extends object ? ComputedFns<T, U[K]> : never)
}

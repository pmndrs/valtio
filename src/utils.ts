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
export const proxyWithComputed = <T extends object, U extends object>(
  initialObject: T,
  computedFns: {
    [K in keyof U]:
      | ((snap: NonPromise<T>) => U[K])
      | {
          get: (snap: NonPromise<T>) => U[K]
          set?: (state: T, newValue: U[K]) => void
        }
  }
) => {
  const NOTIFIER = Symbol()
  Object.defineProperty(initialObject, NOTIFIER, { value: 0 })
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    const computedFn = computedFns[key]
    const { get, set } = (typeof computedFn === 'function'
      ? { get: computedFn }
      : computedFn) as {
      get: (snap: NonPromise<T>) => U[typeof key]
      set?: (state: T, newValue: U[typeof key]) => void
    }
    let computedValue: U[typeof key]
    let prevSnapshot: NonPromise<T> | undefined
    let affected = new WeakMap()
    const desc: PropertyDescriptor = {}
    desc.get = () => {
      const nextSnapshot = snapshot(proxyObject)
      if (
        !prevSnapshot ||
        isDeepChanged(prevSnapshot, nextSnapshot, affected)
      ) {
        affected = new WeakMap()
        computedValue = get(createDeepProxy(nextSnapshot, affected))
        if (computedValue instanceof Promise) {
          computedValue.then((v) => {
            computedValue = v
            ++(proxyObject as any)[NOTIFIER] // HACK notify update
          })
          // XXX no error handling
        }
        prevSnapshot = nextSnapshot
      }
      return computedValue
    }
    if (set) {
      desc.set = (newValue) => set(proxyObject, newValue)
    }
    Object.defineProperty(initialObject, key, desc)
  })
  const proxyObject = proxy(initialObject) as T & U
  return proxyObject
}

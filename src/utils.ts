import { createProxy as createProxyToCompare, isChanged } from 'proxy-compare'
import { proxy, subscribe, snapshot } from './vanilla'
import type { DeepResolveType } from './vanilla'

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
export const subscribeKey = <T extends object>(
  proxyObject: T,
  key: keyof T,
  callback: (value: T[typeof key]) => void,
  notifyInSync?: boolean
) => {
  let prevValue = proxyObject[key]
  return subscribe(
    proxyObject,
    () => {
      const nextValue = proxyObject[key]
      if (!Object.is(prevValue, nextValue)) {
        callback((prevValue = nextValue))
      }
    },
    notifyInSync
  )
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
      } else if (
        message.type === 'DISPATCH' &&
        message.payload?.type === 'IMPORT_STATE'
      ) {
        const actions = message.payload.nextLiftedState?.actionsById
        const computedStates =
          message.payload.nextLiftedState?.computedStates || []

        isTimeTraveling = true

        computedStates.forEach(({ state }: { state: any }, index: number) => {
          const action =
            actions[index] || `Update - ${new Date().toLocaleString()}`

          Object.keys(state).forEach((key) => {
            ;(proxyObject as any)[key] = state[key]
          })

          if (index === 0) {
            devtools.init(snapshot(proxyObject))
          } else {
            devtools.send(action, snapshot(proxyObject))
          }
        })
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
 * This adds computed values to an existing proxy object.
 *
 * [Notes]
 * This comes with a cost and overlaps with useSnapshot.
 * Do not try to optimize too early. It can worsen the performance.
 * Measurement and comparison will be very important.
 *
 * @example
 * import { proxy } from 'valtio'
 * import { addComputed } from 'valtio/utils'
 * const state = proxy({
 *   count: 1,
 * })
 * addComputed(state, {
 *   doubled: snap => snap.count * 2,
 * })
 */
export const addComputed = <T extends object, U extends object>(
  proxyObject: T,
  computedFns: {
    [K in keyof U]: (snap: DeepResolveType<T>) => U[K]
  },
  targetObject: any = proxyObject
) => {
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(targetObject, key)) {
      throw new Error('object property already defined')
    }
    const get = computedFns[key]
    let prevSnapshot: DeepResolveType<T> | undefined
    let affected = new WeakMap()
    let pending = false
    const callback = () => {
      const nextSnapshot = snapshot(proxyObject)
      if (
        !pending &&
        (!prevSnapshot || isChanged(prevSnapshot, nextSnapshot, affected))
      ) {
        affected = new WeakMap()
        const value = get(createProxyToCompare(nextSnapshot, affected))
        prevSnapshot = nextSnapshot
        if (value instanceof Promise) {
          pending = true
          value
            .then((v) => {
              targetObject[key] = v
            })
            .catch((e) => {
              // not ideal but best effort for throwing error with proxy
              targetObject[key] = new Proxy(
                {},
                {
                  get() {
                    throw e
                  },
                }
              )
            })
            .finally(() => {
              pending = false
            })
        }
        targetObject[key] = value
      }
    }
    // FIXME no way to clean up the subscription
    subscribe(proxyObject, callback)
    callback()
  })
}

/**
 * proxyWithComputed
 *
 * This is to create a proxy with initial object and additional object,
 * which specifies getters for computed values with dependency tracking.
 * It also accepts optional setters for computed values.
 *
 * [Notes]
 * This comes with a cost and overlaps with useSnapshot.
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
      | ((snap: DeepResolveType<T>) => U[K])
      | {
          get: (snap: DeepResolveType<T>) => U[K]
          set?: (state: T, newValue: U[K]) => void
        }
  }
) => {
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(initialObject, key)) {
      throw new Error('object property already defined')
    }
    const computedFn = computedFns[key]
    const { get, set } = (
      typeof computedFn === 'function' ? { get: computedFn } : computedFn
    ) as {
      get: (snap: DeepResolveType<T>) => U[typeof key]
      set?: (state: T, newValue: U[typeof key]) => void
    }
    let computedValue: U[typeof key]
    let prevSnapshot: DeepResolveType<T> | undefined
    let affected = new WeakMap()
    const desc: PropertyDescriptor = {}
    desc.get = () => {
      const nextSnapshot = snapshot(proxyObject)
      if (!prevSnapshot || isChanged(prevSnapshot, nextSnapshot, affected)) {
        affected = new WeakMap()
        computedValue = get(createProxyToCompare(nextSnapshot, affected))
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

type WatchGet = <T extends object>(value: T) => T
type WatchCallback = (get: WatchGet) => (() => void) | void | undefined

let currentCleanups: Set<() => void> | undefined

/**
 * watch
 *
 * Creates a reactive effect that automatically tracks proxy objects and
 * reevaluates everytime one of the tracked proxy objects updates. It returns
 * a cleanup function to stop the reactive effect from reevaluating.
 *
 * Callback is invoked immediately to detect the tracked objects.
 *
 * Callback passed to `watch` receives a `get` function that "tracks" the
 * passed proxy object.
 *
 * Watch callbacks may return an optional cleanup function, which is evaluated
 * whenever the callback reevaluates or when the cleanup function returned by
 * `watch` is evaluated.
 *
 * `watch` calls inside `watch` are also automatically tracked and cleaned up
 * whenever the parent `watch` reevaluates.
 *
 * @param callback
 * @returns A cleanup function that stops the callback from reevaluating and
 * also performs cleanups registered into `watch`.
 */
export const watch = (callback: WatchCallback): (() => void) => {
  const cleanups = new Set<() => void>()
  const subscriptions = new Set<object>()

  let alive = true

  const cleanup = () => {
    // Cleanup subscriptions and other pushed callbacks
    cleanups.forEach((clean) => {
      clean()
    })
    // Clear cleanup set
    cleanups.clear()
    // Clear tracked proxies
    subscriptions.clear()
  }

  const revalidate = () => {
    if (!alive) {
      return
    }
    cleanup()
    // Setup watch context, this allows us to automatically capture
    // watch cleanups if the watch callback itself has watch calls.
    const parent = currentCleanups
    currentCleanups = cleanups

    // Ensures that the parent is reset if the callback throws an error.
    try {
      const cleanupReturn = callback((proxy) => {
        subscriptions.add(proxy)
        return proxy
      })

      // If there's a cleanup, we add this to the cleanups set
      if (cleanupReturn) {
        cleanups.add(cleanupReturn)
      }
    } finally {
      currentCleanups = parent
    }

    // Subscribe to all collected proxies
    subscriptions.forEach((proxy) => {
      const clean = subscribe(proxy, revalidate)
      cleanups.add(clean)
    })
  }

  const wrappedCleanup = () => {
    if (alive) {
      cleanup()
      alive = false
    }
  }

  // If there's a parent watch call, we attach this watch's
  // cleanup to the parent.
  if (currentCleanups) {
    currentCleanups.add(wrappedCleanup)
  }

  // Invoke effect to create subscription list
  revalidate()

  return wrappedCleanup
}

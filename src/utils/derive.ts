import { proxy, subscribe, getVersion } from '../vanilla'

type DeriveGet = <T extends object>(proxyObject: T) => T

/**
 * derive
 *
 * This creates derived properties and attatches them
 * to a new proxy object or an existing proxy object.
 *
 * @example
 * import { proxy } from 'valtio'
 * import { derive } from 'valtio/utils'
 *
 * const state = proxy({
 *   count: 1,
 * })
 *
 * const derived = derive({
 *   doubled: (get) => get(state).count * 2,
 * })
 *
 * derive({
 *   tripled: (get) => get(state).count * 3,
 * }, {
 *   proxy: state,
 * })
 */
export const derive = <T extends object, U extends object>(
  derivedFns: {
    [K in keyof U]: (get: DeriveGet) => U[K]
  },
  options?: {
    proxy?: T
    sync?: boolean
    registerCleanup?: (cleanup: () => void) => void
  }
) => {
  const proxyObject = (options?.proxy || proxy({})) as U
  const notifyInSync = options?.sync
  const subscriptions = new Map<
    object,
    [callbackMap: Map<keyof U, () => void>, unsubscribe: () => void]
  >()
  if (options?.registerCleanup) {
    options.registerCleanup(() => {
      subscriptions.forEach(([, unsubscribe]) => {
        unsubscribe()
      })
      subscriptions.clear()
    })
  }
  const addSubscription = (p: object, key: keyof U, callback: () => void) => {
    const subscription = subscriptions.get(p)
    if (subscription) {
      subscription[0].set(key, callback)
    } else {
      const unsubscribe = subscribe(
        p,
        (ops) => {
          if (
            p === proxyObject &&
            ops.every((op) => op[1].length === 1 && op[1][0] in derivedFns)
          ) {
            // only setting derived properties
            return
          }
          subscriptions.get(p)?.[0].forEach((cb) => {
            cb()
          })
        },
        notifyInSync
      )
      subscriptions.set(p, [new Map([[key, callback]]), unsubscribe])
    }
  }
  const removeSubscription = (p: object, key: keyof U) => {
    const subscription = subscriptions.get(p)
    if (subscription) {
      const [callbackMap, unsubscribe] = subscription
      callbackMap.delete(key)
      if (!callbackMap.size) {
        unsubscribe()
        subscriptions.delete(p)
      }
    }
  }
  ;(Object.keys(derivedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(proxyObject, key)) {
      throw new Error('object property already defined')
    }
    const fn = derivedFns[key]
    let lastDependencies: Map<object, number> | null = null
    const evaluate = () => {
      if (lastDependencies) {
        if (
          Array.from(lastDependencies).every(([p, n]) => getVersion(p) === n)
        ) {
          // no dependencies are changed
          return
        }
      }
      const dependencies = new Map<object, number>()
      const get = <P extends object>(p: P) => {
        dependencies.set(p, getVersion(p))
        return p
      }
      const value = fn(get)
      const subscribe = () => {
        dependencies.forEach((_, p) => {
          if (!lastDependencies?.has(p)) {
            addSubscription(p, key, evaluate)
          }
        })
        lastDependencies?.forEach((_, p) => {
          if (!dependencies.has(p)) {
            removeSubscription(p, key)
          }
        })
        lastDependencies = dependencies
      }
      if (value instanceof Promise) {
        value.then(() => {
          subscribe()
          evaluate()
        })
      } else {
        subscribe()
      }
      proxyObject[key] = value
    }
    evaluate()
  })
  return proxyObject as T & U
}

import { getVersion, proxy, subscribe } from '../vanilla'

type DeriveGet = <T extends object>(proxyObject: T) => T

type Subscription<U extends object> = [
  callbackMap: Map<keyof U, () => void>,
  unsubscribe: () => void
]

type Subscriptions<U extends object> = Map<object, Subscription<U>>

const subscriptionsCache = new WeakMap<object, Subscriptions<object>>()

const getSubscriptions = (proxyObject: object) => {
  let subscriptions = subscriptionsCache.get(proxyObject)
  if (!subscriptions) {
    subscriptions = new Map()
    subscriptionsCache.set(proxyObject, subscriptions)
  }
  return subscriptions
}

// NOTE This is experimentally exported.
// The availability is not guaranteed, and it will be renamed,
// changed or removed without any notice in future versions.
// It's not expected to use this in production.
export const unstable_getDeriveSubscriptions = getSubscriptions

// to make derive glitch free: https://github.com/pmndrs/valtio/pull/335
const pendingCountMap = new WeakMap<object, number>()
const markPending = (proxyObject: object) => {
  const count = pendingCountMap.get(proxyObject) || 0
  pendingCountMap.set(proxyObject, count + 1)
}
const unmarkPending = (proxyObject: object) => {
  const count = pendingCountMap.get(proxyObject) || 0
  if (count > 1) {
    pendingCountMap.set(proxyObject, count - 1)
  } else {
    pendingCountMap.delete(proxyObject)
  }
}
const isPending = (proxyObject: object) => {
  const count = pendingCountMap.get(proxyObject) || 0
  return count > 0
}

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
 * const derivedState = derive({
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
  }
) => {
  const proxyObject = (options?.proxy || proxy({})) as U
  const notifyInSync = options?.sync
  const subscriptions: Subscriptions<U> = getSubscriptions(proxyObject)
  const addSubscription = (p: object, key: keyof U, callback: () => void) => {
    let subscription = subscriptions.get(p)
    if (!subscription) {
      const notify = () =>
        (subscription as Subscription<U>)[0].forEach((cb) => cb())
      let promise: Promise<void> | undefined
      const unsubscribe = subscribe(
        p,
        (ops) => {
          if (
            p === proxyObject &&
            ops.every(
              (op) => op[1].length === 1 && (op[1][0] as string) in derivedFns
            )
          ) {
            // only setting derived properties
            return
          }
          if (promise) {
            // already scheduled
            return
          }
          markPending(p)
          if (notifyInSync) {
            unmarkPending(p)
            notify()
          } else {
            promise = Promise.resolve().then(() => {
              promise = undefined
              unmarkPending(p)
              notify()
            })
          }
        },
        true
      )
      subscription = [new Map(), unsubscribe]
      subscriptions.set(p, subscription)
    }
    subscription[0].set(key, callback)
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
        if (Array.from(lastDependencies).some(([p]) => isPending(p))) {
          // some dependencies are still pending
          return
        }
        if (
          Array.from(lastDependencies).every(([p, n]) => getVersion(p) === n)
        ) {
          // no dependencies are changed
          return
        }
      }
      const dependencies = new Map<object, number>()
      const get = <P extends object>(p: P) => {
        dependencies.set(p, getVersion(p) as number)
        return p
      }
      const value = fn(get)
      const subscribeToDependencies = () => {
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
        value.finally(subscribeToDependencies)
      } else {
        subscribeToDependencies()
      }
      proxyObject[key] = value
    }
    evaluate()
  })
  return proxyObject as T & U
}

/**
 * underive
 *
 * This stops derived properties to evaluate.
 * It will stop all (or specified by `keys` option) subscriptions.
 * If you specify `delete` option, it will delete the properties
 * and you can attach new derived properties.
 *
 * @example
 * import { proxy } from 'valtio'
 * import { derive, underive } from 'valtio/utils'
 *
 * const state = proxy({
 *   count: 1,
 * })
 *
 * const derivedState = derive({
 *   doubled: (get) => get(state).count * 2,
 * })
 *
 * underive(derivedState)
 */
export const underive = <T extends object, U extends object>(
  proxyObject: T & U,
  options?: {
    delete?: boolean
    keys?: (keyof U)[]
  }
) => {
  const subscriptions: Subscriptions<U> = getSubscriptions(proxyObject)
  const keysToDelete = options?.delete ? new Set<keyof U>() : null
  subscriptions.forEach(([callbackMap, unsubscribe], p) => {
    if (options?.keys) {
      options.keys.forEach((key) => {
        if (callbackMap.has(key)) {
          callbackMap.delete(key)
          if (keysToDelete) {
            keysToDelete.add(key)
          }
        }
      })
    } else {
      if (keysToDelete) {
        Array.from(callbackMap.keys()).forEach((key) => {
          keysToDelete.add(key)
        })
      }
      callbackMap.clear()
    }
    if (!callbackMap.size) {
      unsubscribe()
      subscriptions.delete(p)
    }
  })
  if (keysToDelete) {
    keysToDelete.forEach((key) => {
      delete proxyObject[key]
    })
  }
}

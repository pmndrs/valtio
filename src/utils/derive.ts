import { getVersion, proxy, subscribe } from '../vanilla'

type DeriveGet = <T extends object>(proxyObject: T) => T

type Subscription = [
  subscriber: object,
  callback: () => void,
  notifyInSync: boolean,
  ignoreKeys: string[],
  promise: Promise<void> | undefined
]

type SubscriptionsEntry = [
  subscriptions: Set<Subscription>,
  unsubscribe: () => void
]

type SubscriberEntry = Map<string, Map<object, Subscription>>

type PendingEntry = [count: number, callbacks: Set<() => void>]

const subscriptionsMap = new WeakMap<object, SubscriptionsEntry>()
const subscriberMap = new WeakMap<object, SubscriberEntry>()
const pendingMap = new Map<object, PendingEntry>()

const markPending = (sourceObject: object) => {
  const subscriptionsEntry = subscriptionsMap.get(sourceObject)
  subscriptionsEntry?.[0].forEach((subscription) => {
    const [subscriber] = subscription
    if (sourceObject !== subscriber) {
      markPending(subscriber)
    }
  })
  let pendingEntry = pendingMap.get(sourceObject)
  if (!pendingEntry) {
    pendingEntry = [0, new Set()]
    pendingMap.set(sourceObject, pendingEntry)
  }
  ++pendingEntry[0]
}

// has side effect (even though used in Array.map)
const checkPending = (sourceObject: object, callback: () => void) => {
  const pendingEntry = pendingMap.get(sourceObject)
  if (pendingEntry) {
    pendingEntry[1].add(callback)
    return true
  }
  return false
}

const unmarkPending = (sourceObject: object) => {
  const pendingEntry = pendingMap.get(sourceObject)
  if (pendingEntry) {
    --pendingEntry[0]
    if (!pendingEntry[0]) {
      pendingMap.delete(sourceObject)
      pendingEntry[1].forEach((callback) => callback())
    }
  }
  const subscriptionsEntry = subscriptionsMap.get(sourceObject)
  subscriptionsEntry?.[0].forEach((subscription) => {
    const [subscriber] = subscription
    if (sourceObject !== subscriber) {
      unmarkPending(subscriber)
    }
  })
}

const addSubscription = (
  sourceObject: object,
  subscriber: object,
  key: string,
  callback: () => void,
  notifyInSync: boolean,
  ignoreKeys: string[]
) => {
  const subscription: Subscription = [
    subscriber,
    callback,
    notifyInSync,
    ignoreKeys,
    undefined
  ]
  let subscriberEntry = subscriberMap.get(subscriber)
  if (!subscriberEntry) {
    subscriberEntry = new Map()
    subscriberMap.set(subscriber, subscriberEntry)
  }
  subscriberEntry.set(
    key,
    (subscriberEntry.get(key) || new Map()).set(sourceObject, subscription)
  )
  let subscriptionsEntry = subscriptionsMap.get(sourceObject)
  if (!subscriptionsEntry) {
    const subscriptions = new Set<Subscription>()
    const unsubscribe = subscribe(
      sourceObject,
      (ops) => {
        subscriptions.forEach((subscription) => {
          const [subscriber, callback, notifyInSync, ignoreKeys] = subscription
          if (
            sourceObject === subscriber &&
            ops.every(
              (op) =>
                op[1].length === 1 && ignoreKeys.includes(op[1][0] as string)
            )
          ) {
            // only setting derived properties
            return
          }
          if (subscription[4]) {
            // already scheduled
            return
          }
          markPending(sourceObject)
          if (notifyInSync) {
            callback()
            unmarkPending(sourceObject)
          } else {
            subscription[4] = Promise.resolve().then(() => {
              subscription[4] = undefined
              callback()
              unmarkPending(sourceObject)
            })
          }
        })
      },
      true
    )
    subscriptionsEntry = [subscriptions, unsubscribe]
    subscriptionsMap.set(sourceObject, subscriptionsEntry)
  }
  subscriptionsEntry[0].add(subscription)
}

const removeSubscription = (
  sourceObject: object,
  subscriber: object,
  key: string
) => {
  const subscriberEntry = subscriberMap.get(subscriber)
  const subscription = subscriberEntry?.get(key)?.get(sourceObject)
  subscriberEntry?.get(key)?.delete(sourceObject)
  if (subscriberEntry?.size === 0) {
    subscriberMap.delete(subscriber)
  }
  const subscriptionsEntry = subscriptionsMap.get(sourceObject)
  if (subscription && subscriptionsEntry) {
    const [subscriptions, unsubscribe] = subscriptionsEntry
    subscriptions.delete(subscription)
    if (!subscriptions.size) {
      unsubscribe()
      subscriptionsMap.delete(sourceObject)
    }
  }
}

const listSubscriptions = (subscriber: object) => {
  const subscriberEntry = subscriberMap.get(subscriber)
  if (subscriberEntry) {
    return Array.from(subscriberEntry.entries())
  }
  return []
}

// NOTE This is experimentally exported.
// The availability is not guaranteed, and it will be renamed,
// changed or removed without any notice in future versions.
// It's not expected to use this in production.
export const unstable_deriveSubscriptions = {
  add: addSubscription,
  remove: removeSubscription,
  list: listSubscriptions,
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
  const notifyInSync = !!options?.sync
  const derivedKeys = Object.keys(derivedFns)
  derivedKeys.forEach((key) => {
    if (Object.getOwnPropertyDescriptor(proxyObject, key)) {
      throw new Error('object property already defined')
    }
    const fn = derivedFns[key as keyof U]
    let lastDependencies: Map<object, number> | null = null
    const evaluate = () => {
      if (lastDependencies) {
        if (
          Array.from(lastDependencies)
            .map(([p]) => checkPending(p, evaluate))
            .some((isPending) => isPending)
        ) {
          // some dependencies are pending
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
            addSubscription(
              p,
              proxyObject,
              key,
              evaluate,
              notifyInSync,
              derivedKeys
            )
          }
        })
        lastDependencies?.forEach((_, p) => {
          if (!dependencies.has(p)) {
            removeSubscription(p, proxyObject, key)
          }
        })
        lastDependencies = dependencies
      }
      if (value instanceof Promise) {
        value.finally(subscribeToDependencies)
      } else {
        subscribeToDependencies()
      }
      proxyObject[key as keyof U] = value
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
  const keysToDelete = options?.delete ? new Set<keyof U>() : null
  listSubscriptions(proxyObject).forEach(([key, subscriptionMap]) => {
    if (!options?.keys || options.keys.includes(key as keyof U)) {
      subscriptionMap.forEach((_subscription, p) => {
        removeSubscription(p, proxyObject, key)
      })
      if (keysToDelete) {
        keysToDelete.add(key as keyof U)
      }
    }
  })
  if (keysToDelete) {
    keysToDelete.forEach((key) => {
      delete proxyObject[key]
    })
  }
}

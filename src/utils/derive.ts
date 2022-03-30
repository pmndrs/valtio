import { getVersion, proxy, subscribe } from '../vanilla'

type DeriveGet = <T extends object>(proxyObject: T) => T

type Subscription = {
  s: object // "s"ourceObject
  d: object // "d"erivedObject
  k: string // derived "k"ey
  c: () => void // "c"allback
  n: boolean // "n"otifyInSync
  i: string[] // "i"goringKeys
  p?: Promise<void> // "p"romise
}

type SourceObjectEntry = [
  subscriptions: Set<Subscription>,
  unsubscribe: () => void,
  pendingCount: number,
  pendingCallbacks: Set<() => void>
]

type DerivedObjectEntry = [subscriptions: Set<Subscription>]

const sourceObjectMap = new WeakMap<object, SourceObjectEntry>()
const derivedObjectMap = new WeakMap<object, DerivedObjectEntry>()

const markPending = (sourceObject: object, callback?: () => void) => {
  const sourceObjectEntry = sourceObjectMap.get(sourceObject)
  if (sourceObjectEntry) {
    sourceObjectEntry[0].forEach((subscription) => {
      const { d: derivedObject } = subscription
      if (sourceObject !== derivedObject) {
        markPending(derivedObject)
      }
    })
    ++sourceObjectEntry[2] // pendingCount
    if (callback) {
      sourceObjectEntry[3].add(callback) // pendingCallbacks
    }
  }
}

// has side effect (even though used in Array.map)
const checkPending = (sourceObject: object, callback: () => void) => {
  const sourceObjectEntry = sourceObjectMap.get(sourceObject)
  if (sourceObjectEntry?.[2]) {
    sourceObjectEntry[3].add(callback) // pendingCallbacks
    return true
  }
  return false
}

const unmarkPending = (sourceObject: object) => {
  const sourceObjectEntry = sourceObjectMap.get(sourceObject)
  if (sourceObjectEntry) {
    --sourceObjectEntry[2] // pendingCount
    if (!sourceObjectEntry[2]) {
      sourceObjectEntry[3].forEach((callback) => callback())
      sourceObjectEntry[3].clear() // pendingCallbacks
    }
    sourceObjectEntry[0].forEach((subscription) => {
      const { d: derivedObject } = subscription
      if (sourceObject !== derivedObject) {
        unmarkPending(derivedObject)
      }
    })
  }
}

const addSubscription = (subscription: Subscription) => {
  const { s: sourceObject, d: derivedObject } = subscription
  let derivedObjectEntry = derivedObjectMap.get(derivedObject)
  if (!derivedObjectEntry) {
    derivedObjectEntry = [new Set()]
    derivedObjectMap.set(subscription.d, derivedObjectEntry)
  }
  derivedObjectEntry[0].add(subscription)
  let sourceObjectEntry = sourceObjectMap.get(sourceObject)
  if (!sourceObjectEntry) {
    const subscriptions = new Set<Subscription>()
    const unsubscribe = subscribe(
      sourceObject,
      (ops) => {
        subscriptions.forEach((subscription) => {
          const {
            d: derivedObject,
            c: callback,
            n: notifyInSync,
            i: ignoreKeys,
          } = subscription
          if (
            sourceObject === derivedObject &&
            ops.every(
              (op) =>
                op[1].length === 1 && ignoreKeys.includes(op[1][0] as string)
            )
          ) {
            // only setting derived properties
            return
          }
          if (subscription.p) {
            // already scheduled
            return
          }
          markPending(sourceObject, callback)
          if (notifyInSync) {
            unmarkPending(sourceObject)
          } else {
            subscription.p = Promise.resolve().then(() => {
              delete subscription.p // promise
              unmarkPending(sourceObject)
            })
          }
        })
      },
      true
    )
    sourceObjectEntry = [subscriptions, unsubscribe, 0, new Set()]
    sourceObjectMap.set(sourceObject, sourceObjectEntry)
  }
  sourceObjectEntry[0].add(subscription)
}

const removeSubscription = (subscription: Subscription) => {
  const { s: sourceObject, d: derivedObject } = subscription
  const derivedObjectEntry = derivedObjectMap.get(derivedObject)
  derivedObjectEntry?.[0].delete(subscription)
  if (derivedObjectEntry?.[0].size === 0) {
    derivedObjectMap.delete(derivedObject)
  }
  const sourceObjectEntry = sourceObjectMap.get(sourceObject)
  if (sourceObjectEntry) {
    const [subscriptions, unsubscribe] = sourceObjectEntry
    subscriptions.delete(subscription)
    if (!subscriptions.size) {
      unsubscribe()
      sourceObjectMap.delete(sourceObject)
    }
  }
}

const listSubscriptions = (derivedObject: object) => {
  const derivedObjectEntry = derivedObjectMap.get(derivedObject)
  if (derivedObjectEntry) {
    return Array.from(derivedObjectEntry[0]) // NOTE do we need to copy?
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
export function derive<T extends object, U extends object>(
  derivedFns: {
    [K in keyof U]: (get: DeriveGet) => U[K]
  },
  options?: {
    proxy?: T
    sync?: boolean
  }
) {
  const proxyObject = (options?.proxy || proxy({})) as U
  const notifyInSync = !!options?.sync
  const derivedKeys = Object.keys(derivedFns)
  derivedKeys.forEach((key) => {
    if (Object.getOwnPropertyDescriptor(proxyObject, key)) {
      throw new Error('object property already defined')
    }
    const fn = derivedFns[key as keyof U]
    type DependencyEntry = {
      v: number // "v"ersion
      s?: Subscription // "s"ubscription
    }
    let lastDependencies: Map<object, DependencyEntry> | null = null
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
          Array.from(lastDependencies).every(
            ([p, entry]) => getVersion(p) === entry.v
          )
        ) {
          // no dependencies are changed
          return
        }
      }
      const dependencies = new Map<object, DependencyEntry>()
      const get = <P extends object>(p: P) => {
        dependencies.set(p, { v: getVersion(p) as number })
        return p
      }
      const value = fn(get)
      const subscribeToDependencies = () => {
        dependencies.forEach((entry, p) => {
          const lastSubscription = lastDependencies?.get(p)?.s
          if (lastSubscription) {
            entry.s = lastSubscription
          } else {
            const subscription: Subscription = {
              s: p, // sourceObject
              d: proxyObject, // derivedObject
              k: key, // derived key
              c: evaluate, // callback
              n: notifyInSync,
              i: derivedKeys, // ignoringKeys
            }
            addSubscription(subscription)
            entry.s = subscription
          }
        })
        lastDependencies?.forEach((entry, p) => {
          if (!dependencies.has(p) && entry.s) {
            removeSubscription(entry.s)
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
export function underive<T extends object, U extends object>(
  proxyObject: T & U,
  options?: {
    delete?: boolean
    keys?: (keyof U)[]
  }
) {
  const keysToDelete = options?.delete ? new Set<keyof U>() : null
  listSubscriptions(proxyObject).forEach((subscription) => {
    const { k: key } = subscription
    if (!options?.keys || options.keys.includes(key as keyof U)) {
      removeSubscription(subscription)
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

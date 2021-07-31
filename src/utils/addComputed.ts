import { createProxy as createProxyToCompare, isChanged } from 'proxy-compare'
import { subscribe, snapshot } from '../vanilla'
import type { DeepResolveType } from '../vanilla'

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

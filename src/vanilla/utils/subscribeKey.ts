import { subscribe } from '../../vanilla'

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
export function subscribeKey<T extends object, K extends keyof T>(
  proxyObject: T,
  key: K,
  callback: (value: T[K]) => void,
  notifyInSync?: boolean
) {
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

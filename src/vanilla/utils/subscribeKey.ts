import { subscribe } from '../../vanilla.js'

/**
 * subscribeKey
 *
 * The subscribeKey utility enables subscription to a primitive subproperty of a given state proxy.
 * Subscriptions created with subscribeKey will only fire when the specified property changes.
 * Like subscribe(), the callback runs synchronously; use batch() to group changes.
 *
 * @example
 * import { subscribeKey } from 'valtio/utils'
 * subscribeKey(state, 'count', (v) => console.log('state.count has changed to', v))
 */
export function subscribeKey<T extends object, K extends keyof T>(
  proxyObject: T,
  key: K,
  callback: (value: T[K]) => void,
): () => void {
  // eslint-disable-next-line prefer-rest-params
  if (typeof arguments[3] === 'boolean') {
    throw new Error(
      'notifyInSync has been removed. subscribeKey() is synchronous. Use batch() to group notifications.',
    )
  }
  let prevValue = proxyObject[key]
  // TODO: Build this on a key-level subscription when subscriptions become
  // key-level. It reads the live value on every notification of proxyObject,
  // so a write to key made by an earlier callback in the current round is
  // reported before the other subscribers receive the current change.
  return subscribe(proxyObject, () => {
    const nextValue = proxyObject[key]
    if (!Object.is(prevValue, nextValue)) {
      callback((prevValue = nextValue))
    }
  })
}

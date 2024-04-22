import { subscribe } from '../../vanilla.ts'

/**
 * subscribeKeys
 *
 * The subscribeKeys utility enables subscription to multiple primitive subproperties of a given state proxy.
 * Subscriptions created with subscribeKeys will only fire when any of the specified properties change.
 * notifyInSync: same as the parameter to subscribe(); true disables batching of subscriptions.
 *
 * @example
 * import { subscribeKeys } from 'valtio/utils'
 * subscribeKey(state, ['name', 'surname'], (v, old) => console.log('state.surname has changed from', old[1], 'to', v[1]))
 */
export function subscribeKeys<
  T extends object,
  K extends ReadonlyArray<keyof T>,
  V extends {
    [I in keyof K]: T[K[I]]
  },
>(
  proxyObject: T,
  keys: K,
  callback: (values: V, prevValues?: V) => void,
  notifyInSync?: boolean,
) {
  let prevValues = keys.map((key) => proxyObject[key]) as unknown as V
  return subscribe(
    proxyObject,
    () => {
      const nextValues = keys.map((key) => proxyObject[key]) as unknown as V
      if (
        nextValues.some((nextValue, i) => !Object.is(prevValues[i], nextValue))
      ) {
        callback(nextValues, prevValues)
        prevValues = nextValues
      }
    },
    notifyInSync,
  )
}

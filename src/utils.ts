import { useRef } from 'react'
import { proxy, useProxy, subscribe } from 'valtio'

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

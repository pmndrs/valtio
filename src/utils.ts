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

export const subscribeKey = <TProxy extends unknown, TProperty>(
  proxy: TProxy,
  key: string,
  callback: (val: TProperty) => void
) => {
  let prevValue = (proxy as any)[key]
  return subscribe(proxy, () => {
    const nextValue = (proxy as any)[key]
    if (!Object.is(prevValue, nextValue)) {
      prevValue = nextValue
      callback(nextValue)
    }
  })
}

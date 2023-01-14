import { useSnapshot } from '../react'
import { useLayoutEffect } from 'react'

/**
 * useProxy
 *
 * Takes a proxy and returns a new proxy which you can use in both react render
 * and in callbacks. For the best ergonomics, you can export a custom hook from
 * your store, so you don't have to figure out a separate name for the hook
 * reference. E.g.:
 *
 * export const store = proxy(initialState)
 * export const useStore = () => useProxy(store)
 * // in the component file:
 * function Cmp() {
 *   const store = useStore()
 *   return <button onClick={() => {store.count++}}>{store.count}</button>
 * }
 *
 * @param proxy
 * @returns A new proxy which you can use in the render as well as in callbacks.
 */
export const useProxy = <T extends object>(proxy: T) => {
  const snapshot = useSnapshot(proxy)

  let isRendering = true

  useLayoutEffect(() => {
    isRendering = false
  })

  return new Proxy<T>(proxy, {
    get: function (target, prop) {
      return isRendering ? snapshot[prop] : target[prop]
    },
  })
}

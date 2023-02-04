import { proxy, snapshot } from 'valtio/vanilla'
import type { INTERNAL_Snapshot as Snapshot } from 'valtio/vanilla'

/**
 * proxyWithComputed (DEPRECATED)
 *
 * @deprecated Please follow "Computed Properties" guide in docs.
 */
export function proxyWithComputed_DEPRECATED<
  T extends object,
  U extends object
>(
  initialObject: T,
  computedFns: {
    [K in keyof U]:
      | ((snap: Snapshot<T>) => U[K])
      | {
          get: (snap: Snapshot<T>) => U[K]
          set?: (state: T, newValue: U[K]) => void
        }
  }
) {
  if (import.meta.env?.MODE !== 'production') {
    console.warn(
      'proxyWithComputed is deprecated. Please follow "Computed Properties" guide in docs.'
    )
  }
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(initialObject, key)) {
      throw new Error('object property already defined')
    }
    const computedFn = computedFns[key]
    const { get, set } = (
      typeof computedFn === 'function' ? { get: computedFn } : computedFn
    ) as {
      get: (snap: Snapshot<T>) => U[typeof key]
      set?: (state: T, newValue: U[typeof key]) => void
    }
    const desc: PropertyDescriptor = {}
    desc.get = () => get(snapshot(proxyObject))
    if (set) {
      desc.set = (newValue) => set(proxyObject, newValue)
    }
    Object.defineProperty(initialObject, key, desc)
  })
  const proxyObject = proxy(initialObject) as T & U
  return proxyObject
}

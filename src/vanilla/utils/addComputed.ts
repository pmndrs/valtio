import { derive } from './derive'

/**
 * addComputed (DEPRECATED)
 *
 * @deprecated Please consider using `derive` or `proxyWithComputed` instead.
 */
export function addComputed_DEPRECATED<T extends object, U extends object>(
  proxyObject: T,
  computedFns_FAKE: {
    [K in keyof U]: (snap_FAKE: T) => U[K]
  },
  targetObject: any = proxyObject
) {
  if (import.meta.env?.MODE !== 'production') {
    console.warn(
      'addComputed is deprecated. Please consider using `derive`. Falling back to emulation with derive. https://github.com/pmndrs/valtio/pull/201'
    )
  }
  const derivedFns: {
    [K in keyof U]: (get: any) => U[K]
  } = {} as any
  ;(Object.keys(computedFns_FAKE) as (keyof U)[]).forEach((key) => {
    derivedFns[key] = (get) => computedFns_FAKE[key](get(proxyObject))
  })
  return derive(derivedFns, { proxy: targetObject })
}

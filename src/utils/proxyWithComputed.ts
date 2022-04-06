import { createProxy as createProxyToCompare, isChanged } from 'proxy-compare'
import { proxy, snapshot } from '../vanilla'
import type { Snapshot } from '../vanilla'

type GetCompleted<C> = {
  [k in keyof C]: C[k] extends (...args: any[]) => infer R
    ? R
    : C[k] extends { get: (...args: any[]) => infer R }
    ? R
    : C[k]
}

/**
 * proxyWithComputed
 *
 * This is to create a proxy with initial object and additional object,
 * which specifies getters for computed values with dependency tracking.
 * It also accepts optional setters for computed values.
 *
 * [Notes]
 * This comes with a cost and overlaps with useSnapshot.
 * Do not try to optimize too early. It can worsen the performance.
 * Measurement and comparison will be very important.
 *
 * @example
 * import { proxyWithComputed } from 'valtio/utils'
 * const state = proxyWithComputed({
 *   count: 1,
 * }, {
 *   doubled() {
 *     return this.count * 2;
 *   },
 *   quadrupled: {
 *     get() {
 *       return this.doubled * 2;
 *     },
 *     set(v: number) {
 *       this.count = v >> 2;
 *     },
 *   },
 * })
 */
export function proxyWithComputed<T extends object, U>(
  initialObject: T,
  computedFns: U & ThisType<T & GetCompleted<U>>
): T & GetCompleted<U> {
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(initialObject, key)) {
      throw new Error('object property already defined')
    }
    const computedFn = computedFns[key]
    const { get, set } = (typeof computedFn === 'function'
      ? { get: computedFn }
      : computedFn) as unknown as {
      get: () => U[typeof key]
      set?: (newValue: U[typeof key]) => void
    }
    let computedValue: U[typeof key]
    let prevSnapshot: Snapshot<T> | undefined
    let affected = new WeakMap()
    const desc: PropertyDescriptor = {}
    desc.get = () => {
      const nextSnapshot = snapshot(proxyObject)
      if (!prevSnapshot || isChanged(prevSnapshot, nextSnapshot, affected)) {
        affected = new WeakMap()
        computedValue = get.call(createProxyToCompare(nextSnapshot, affected))
        prevSnapshot = nextSnapshot
      }
      return computedValue
    }
    if (set) {
      desc.set = (newValue) => set.call(proxyObject, newValue)
    }
    Object.defineProperty(initialObject, key, desc)
  })
  const proxyObject = proxy(initialObject) as T & GetCompleted<U>
  return proxyObject
}

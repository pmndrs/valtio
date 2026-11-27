import {
  isProxyObject,
  snapshot,
  unstable_getInternalStates,
  unstable_isRef,
} from '../../vanilla.js'
import type { Snapshot } from '../../vanilla.js'
import { getOriginalObject } from '../proxyCompare.js'

const { batchAsWrite, getObjectId, proxyStateMap, snapshotBrand } =
  unstable_getInternalStates()

type AnyObject = Record<string | symbol, unknown>

const isObject = (x: unknown): x is AnyObject =>
  typeof x === 'object' && x !== null

const hasOwn = (obj: object, key: string | symbol): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key)

const isSnapshot = (x: object): boolean => hasOwn(x, snapshotBrand)

// A value read from useSnapshot is unwrapped, so that reading it here isn't
// recorded as a use by its component.
const unwrap = (x: unknown): unknown => (isObject(x) ? getOriginalObject(x) : x)

// Plain objects, arrays and snapshots are data, which is merged or copied.
// Anything else is a value that an assignment stores as it is: a proxy, an
// object marked with ref, a Date, a class instance and so on.
const isData = (x: unknown): x is AnyObject => {
  if (!isObject(x) || isProxyObject(x) || unstable_isRef(x)) {
    return false
  }
  const proto = Object.getPrototypeOf(x)
  return (
    isSnapshot(x) ||
    proto === Object.prototype ||
    proto === Array.prototype ||
    !proto
  )
}

// The methods of a collection read its own data, so its snapshot can be
// neither merged key by key nor copied into a collection that works.
const assertNoCollection = (snap: AnyObject): void => {
  if (!Array.isArray(snap) && Symbol.iterator in snap) {
    throw new Error(
      'applyChanges() cannot apply a snapshot of a proxyMap or proxySet. Assign a new collection that is created from its entries.',
    )
  }
}

// Whether a snapshot was taken from the object of a proxy.
const isSnapshotOf = (snap: AnyObject, proxyObject: object): boolean =>
  snap[snapshotBrand] === getObjectId(proxyStateMap.get(proxyObject)![0])

// The own enumerable keys, which leaves out the brand of a snapshot and the
// length of an array. A key with an accessor is listed with `false`.
const keysOf = (obj: object): [key: string | symbol, isValue: boolean][] =>
  Reflect.ownKeys(obj).flatMap((key) => {
    const desc = Reflect.getOwnPropertyDescriptor(obj, key)!
    return desc.enumerable ? [[key, 'value' in desc]] : []
  })

const apply = (proxyObject: AnyObject, data: AnyObject): void => {
  // The objects of `data` that are merged, with the proxies they went into.
  const merged = new Map<object, Set<object>>()
  // The objects of `data` that are copied, with their copy.
  const copies = new Map<object, object>()
  // The writes are collected first, so that an error leaves the state as it
  // was.
  const writes: (() => void)[] = []

  // Copies data, so that an object of the caller never becomes state.
  const copy = (value: unknown): unknown => {
    if (!isData(value)) {
      return value
    }
    let result = copies.get(value) as AnyObject | undefined
    if (!result) {
      if (isSnapshot(value)) {
        assertNoCollection(value)
      }
      result = Array.isArray(value)
        ? []
        : Object.create(Object.getPrototypeOf(value))
      copies.set(value, result!)
      for (const [key, isValue] of keysOf(value)) {
        if (isValue) {
          result![key] = copy(unwrap(value[key]))
        } else {
          // an accessor comes with its object
          Object.defineProperty(
            result,
            key,
            Reflect.getOwnPropertyDescriptor(value, key)!,
          )
        }
      }
    }
    return result
  }

  const merge = (target: AnyObject, next: AnyObject): void => {
    let targets = merged.get(next)
    if (!targets) {
      merged.set(next, (targets = new Set()))
    }
    if (targets.has(target)) {
      // a cycle
      return
    }
    targets.add(target)
    if (isSnapshot(next)) {
      // A snapshot that the proxy still has means that nothing changed.
      if (snapshot(target) === next) {
        return
      }
      assertNoCollection(next)
    }
    if (Array.isArray(target) && Array.isArray(next)) {
      if (target.length > next.length) {
        writes.push(() => {
          target.length = next.length
        })
      }
    } else {
      for (const [key, isValue] of keysOf(target)) {
        if (isValue && !hasOwn(next, key)) {
          writes.push(() => {
            delete target[key]
          })
        }
      }
    }
    for (const [key, isValue] of keysOf(next)) {
      const desc = Reflect.getOwnPropertyDescriptor(target, key)
      if (!isValue || (desc && !('value' in desc))) {
        // Accessors are never written. The proxy has its own.
        continue
      }
      const value = unwrap(next[key])
      const current = target[key]
      if (
        Object.is(current, value) &&
        (value !== undefined || hasOwn(target, key))
      ) {
        continue
      }
      if (
        isProxyObject(current) &&
        isData(value) &&
        Array.isArray(current) === Array.isArray(value) &&
        // A snapshot is merged only into the object that it was taken from.
        (!isSnapshot(value) || isSnapshotOf(value, current as object))
      ) {
        merge(current as AnyObject, value)
      } else {
        const copied = copy(value)
        writes.push(() => {
          target[key] = copied
        })
      }
    }
  }

  merge(proxyObject, data)
  batchAsWrite(() => writes.forEach((write) => write()))
}

/**
 * Makes the data of a proxy equal to `next`, writing only what differs.
 *
 * Use it instead of an assignment to replace data without notifying the
 * subscribers of values that didn't change. It notifies once.
 *
 * `next` can be plain data, a snapshot, or a value read from `useSnapshot`.
 * Its plain objects, arrays and snapshots are merged into the proxies that
 * are already there, or copied, so they never become state themselves.
 * Any other value is assigned as it is.
 *
 * @example
 * import { proxy } from 'valtio'
 * import { applyChanges } from 'valtio/utils'
 *
 * const state = proxy({ user: { name: 'Ann', age: 30 } })
 * // writes only state.user.age
 * applyChanges(state, { user: { name: 'Ann', age: 31 } })
 */
export function applyChanges<T extends object>(
  proxyObject: T,
  next: T | Snapshot<T>,
): void {
  if (!isProxyObject(proxyObject)) {
    throw new Error('applyChanges() requires a proxy as its first argument.')
  }
  apply(proxyObject as AnyObject, unwrap(next) as AnyObject)
}

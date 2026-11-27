import {
  isProxyObject,
  unstable_getInternalStates,
  unstable_isRef,
} from '../../vanilla.js'
import type { Snapshot } from '../../vanilla.js'
import { getOriginalObject } from '../proxyCompare.js'

const { batchAsWrite, getObjectId, proxyStateMap, snapCache, snapshotBrand } =
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
// The prototype of a plain object has none itself, and the one of a plain
// array has one that has none. That also holds for data from another realm,
// such as an iframe, and it leaves out a class that extends Array.
const isData = (x: unknown): x is AnyObject => {
  if (!isObject(x) || isProxyObject(x) || unstable_isRef(x)) {
    return false
  }
  let proto = Object.getPrototypeOf(x)
  if (proto && Array.isArray(x)) {
    proto = Object.getPrototypeOf(proto)
  }
  return isSnapshot(x) || !proto || !Object.getPrototypeOf(proto)
}

// A proxyMap or a proxySet, or a snapshot of one. Its methods read its own
// data, so it can be neither merged key by key nor copied into a collection
// that works. The tag is read from the property, so that no getter runs.
const isCollection = (x: object): boolean => {
  const tag = Reflect.getOwnPropertyDescriptor(x, Symbol.toStringTag)?.value
  return tag === 'Map' || tag === 'Set'
}

const assertNoCollection = (snap: AnyObject): void => {
  if (isCollection(snap)) {
    throw new Error(
      'applyChanges() cannot apply a snapshot of a proxyMap or proxySet. Assign a new collection that is created from its entries.',
    )
  }
}

// Whether a key has an accessor, its own or one of a class.
const hasAccessor = (obj: object | null, key: string | symbol): boolean => {
  for (; obj; obj = Object.getPrototypeOf(obj)) {
    const desc = Reflect.getOwnPropertyDescriptor(obj, key)
    if (desc) {
      return !('value' in desc)
    }
  }
  return false
}

// Whether a snapshot was taken from the object of a proxy.
const isSnapshotOf = (snap: AnyObject, proxyObject: object): boolean =>
  snap[snapshotBrand] === getObjectId(proxyStateMap.get(proxyObject)![0])

// Whether a snapshot is the one that a proxy has now, which means that
// nothing changed under the proxy since. It makes no new snapshot.
const isCurrentSnapshot = (snap: object, proxyObject: object): boolean => {
  const [target, ensureVersion] = proxyStateMap.get(proxyObject)!
  const cache = snapCache.get(target)
  return !!cache && cache[1] === snap && cache[0] === ensureVersion()
}

// The own enumerable keys, which leaves out the brand of a snapshot and the
// length of an array. A key with an accessor is listed with `false`.
// `__proto__` is left out, because an assignment to it sets the prototype.
const keysOf = (obj: object): [key: string | symbol, isValue: boolean][] =>
  Reflect.ownKeys(obj).flatMap((key) => {
    const desc = Reflect.getOwnPropertyDescriptor(obj, key)!
    return desc.enumerable && key !== '__proto__'
      ? [[key, 'value' in desc]]
      : []
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
        ? // the length keeps the holes at the end
          new Array(value.length)
        : Object.create(Object.getPrototypeOf(value))
      copies.set(value, result!)
      for (const [key, isValue] of keysOf(value)) {
        // A property is defined, because an assignment would run a setter
        // of a class. An accessor comes with its object.
        Object.defineProperty(
          result,
          key,
          isValue
            ? {
                value: copy(unwrap(value[key])),
                writable: true,
                enumerable: true,
                configurable: true,
              }
            : Reflect.getOwnPropertyDescriptor(value, key)!,
        )
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
      if (isCurrentSnapshot(next, target)) {
        return
      }
      assertNoCollection(next)
    }
    // An array takes the length first, which drops the indices beyond it in
    // one write. Deleting them below then changes nothing.
    if (
      Array.isArray(target) &&
      Array.isArray(next) &&
      target.length !== next.length
    ) {
      writes.push(() => {
        target.length = next.length
      })
    }
    // A key that next has but doesn't enumerate is missing, as for the writes.
    for (const [key, isValue] of keysOf(target)) {
      if (isValue && !Reflect.getOwnPropertyDescriptor(next, key)?.enumerable) {
        writes.push(() => {
          delete target[key]
        })
      }
    }
    for (const [key, isValue] of keysOf(next)) {
      if (!isValue || hasAccessor(target, key)) {
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
        // A proxy marked with ref is a value of its own, as any ref is.
        !unstable_isRef(current) &&
        // not a proxy that the target inherits
        hasOwn(target, key) &&
        isData(value) &&
        Array.isArray(current) === Array.isArray(value) &&
        // A snapshot is merged only into the object that it was taken from,
        // and other data isn't merged into a collection.
        (isSnapshot(value)
          ? isSnapshotOf(value, current as object)
          : !isCollection(current as AnyObject))
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
  // A collection is written with its methods. It has no keys to merge.
  if (!isProxyObject(proxyObject) || isCollection(proxyObject)) {
    throw new Error(
      'applyChanges() requires a proxy as its first argument, and it cannot be a proxyMap or proxySet.',
    )
  }
  const data = unwrap(next) as AnyObject
  // A nested value of the other kind is replaced, but the proxy itself can't
  // be.
  if (Array.isArray(proxyObject) !== Array.isArray(data)) {
    throw new Error(
      'applyChanges() cannot apply an array to an object, or an object to an array.',
    )
  }
  apply(proxyObject as AnyObject, data)
}

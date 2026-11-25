import { unstable_getInternalStates } from '../../vanilla.js'
import { getOriginalObject, trackMemo } from '../proxyCompare.js'

const { proxyStateMap, refSet, snapshotBrand, getObjectId } =
  unstable_getInternalStates()

// An object that has Symbol.iterator isn't proxied, so a lookup stores that
// key under this symbol.
const iteratorId = Symbol()

/**
 * Gives a Map key or a Set member the property key that a collection's
 * lookup stores it under.
 *
 * An object, its proxy and its snapshots get the same id, so each of them
 * finds the entry. An object marked with `ref` is only itself. Other values
 * get a string that keeps their types apart and treats NaN and -0 as a Map
 * does.
 */
export const keyId = (key: unknown): string | symbol => {
  if (typeof key === 'symbol') {
    return key === Symbol.iterator ? iteratorId : key
  }
  if ((typeof key === 'object' && key !== null) || typeof key === 'function') {
    // A value read from useSnapshot is unwrapped. It is first marked as used
    // as a whole, so that its component re-renders when it is replaced.
    trackMemo(key)
    const obj = getOriginalObject(key) as Record<symbol, symbol>
    return !refSet.has(obj) &&
      Object.prototype.hasOwnProperty.call(obj, snapshotBrand)
      ? (obj[snapshotBrand] as symbol)
      : getObjectId(proxyStateMap.get(obj)?.[0] || obj)
  }
  return `${typeof key}:${key === 0 ? 0 : key}`
}

/**
 * Yields the slots of a collection's `data` that are in use, in insertion
 * order. As with a Map or a Set, an entry added during the iteration is
 * visited, and one deleted before its turn is skipped. Clearing ends the
 * iteration, also for entries added after it, which a Map would visit.
 */
export function* slotsOf(collection: { data: unknown[] }): Generator<number> {
  const data = collection.data
  const end = data.length
  for (const index of Reflect.ownKeys(data)) {
    // the indices come first, in order, and then `length`
    if (index === 'length') {
      break
    }
    // clear() replaces `data`
    if (collection.data !== data) {
      return
    }
    const slot = Number(index)
    if (slot in data) {
      yield slot
    }
  }
  // the entries added during the iteration
  for (let slot = end; slot < data.length; slot++) {
    if (collection.data !== data) {
      return
    }
    if (slot in data) {
      yield slot
    }
  }
}

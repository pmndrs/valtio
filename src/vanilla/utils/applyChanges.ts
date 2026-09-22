import { unstable_getInternalStates } from '../../vanilla.js'

const { proxyStateMap, refSet } = unstable_getInternalStates()
const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => {
  if (!value || typeof value !== 'object' || refSet.has(value)) {
    return false
  }
  const prototype = Reflect.getPrototypeOf(value)
  return (
    Array.isArray(value) || prototype === Object.prototype || prototype === null
  )
}

export function applyChanges<T extends object>(state: T, next: T): void {
  const seen = new WeakMap<object, WeakSet<object>>()
  const apply = (
    state: Record<PropertyKey, unknown>,
    next: Record<PropertyKey, unknown>,
  ) => {
    let sources = seen.get(state)
    if (sources?.has(next)) return
    if (!sources) seen.set(state, (sources = new WeakSet()))
    sources.add(next)
    const keys = Reflect.ownKeys(next)
    const properties = new Map(
      keys.map((key) => [key, Reflect.getOwnPropertyDescriptor(next, key)!]),
    )
    if ([...properties.values()].some((property) => !('value' in property))) {
      throw new Error('applyChanges supports data properties only')
    }
    if (
      keys.some(
        (key) =>
          !Reflect.getOwnPropertyDescriptor(state, key) &&
          Reflect.has(state, key),
      )
    ) {
      throw new Error('applyChanges does not add inherited keys')
    }
    Reflect.ownKeys(state).forEach((key) => {
      if (!properties.has(key) && !Reflect.deleteProperty(state, key)) {
        throw new Error('applyChanges could not delete a property')
      }
    })
    const orderedKeys = Array.isArray(next)
      ? keys.filter((key) => key !== 'length').concat('length')
      : keys
    orderedKeys.forEach((key) => {
      const value = properties.get(key)!.value
      const property = Reflect.getOwnPropertyDescriptor(state, key)
      const previous = property?.value
      if (property && 'value' in property && Object.is(previous, value)) return
      if (
        isRecord(previous) &&
        proxyStateMap.has(previous) &&
        isRecord(value) &&
        !proxyStateMap.has(value) &&
        Reflect.getPrototypeOf(previous) === Reflect.getPrototypeOf(value)
      ) {
        apply(previous, value)
      } else if (!Reflect.set(state, key, value)) {
        throw new Error('applyChanges could not set a property')
      }
    })
  }
  if (
    !isRecord(state) ||
    !proxyStateMap.has(state) ||
    !isRecord(next) ||
    Reflect.getPrototypeOf(state) !== Reflect.getPrototypeOf(next)
  ) {
    throw new Error('applyChanges requires compatible records or arrays')
  }
  apply(state, next)
}

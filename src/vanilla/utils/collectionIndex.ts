import { proxy, ref } from '../../vanilla.js'

const objectKeys = new WeakMap<object, symbol>()

export const getIndexKey = (key: unknown): string | symbol => {
  if ((typeof key === 'object' && key !== null) || typeof key === 'function') {
    let id = objectKeys.get(key)
    if (!id) objectKeys.set(key, (id = Symbol()))
    return id
  }
  return typeof key === 'symbol' ? key : `${typeof key}:${String(key)}`
}

export const createIndex = <K>(
  map: Map<K, number>,
): {
  size: number
  version: number
} & Record<PropertyKey, unknown> => {
  const index = Object.assign(Object.create(null), {
    size: map.size,
    version: 0,
  })
  // Skip proxy initialization for opaque index entries.
  const state = proxy(index)
  map.forEach((slot, key) => {
    index[getIndexKey(key)] = slot
    index[slot] = ref({ key })
  })
  state.version++
  return index
}

export const clearIndex = (index: Record<PropertyKey, unknown>): void => {
  Reflect.ownKeys(index).forEach((key) => {
    if (key !== 'size' && key !== 'version') delete index[key]
  })
  index.size = 0
}

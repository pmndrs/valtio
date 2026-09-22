import { ref } from '../../vanilla.js'

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
  positions: Record<string | symbol, number>
  entries: { key: K }[]
  size: number
} => {
  const positions = Object.create(null) as Record<string | symbol, number>
  const entries: { key: K }[] = []
  map.forEach((index, key) => {
    positions[getIndexKey(key)] = index
    entries[index] = ref({ key })
  })
  return { positions, entries, size: map.size }
}

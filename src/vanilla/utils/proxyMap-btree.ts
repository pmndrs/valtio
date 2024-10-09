import BTree from 'sorted-btree/b+tree.js'
import { getVersion, proxy } from '../../vanilla.ts'

const maybeProxify = (x: any) => proxy({ x }).x

const isImmutable = (x: any) => getVersion(x) === undefined

type InternalProxyObject<K, V> = Map<K, V> & {
  data: BTree<K, V>
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const btree = new BTree<K, V>()

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      btree.set(key, value)
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: btree,
    get size() {
      return btree.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      return btree.get(k)
    },
    has(key: K) {
      const k = maybeProxify(key)
      return btree.has(k)
    },
    set(key: K, value: V) {
      if (isImmutable(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return this
        }
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      btree.set(k, v)
      return this
    },
    delete(key: K) {
      if (isImmutable(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return false
        }
      }
      const k = maybeProxify(key)
      return btree.delete(k)
    },
    clear() {
      if (isImmutable(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return
        }
      }
      btree.clear()
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      btree.forEach((value: V, key: K) => {
        cb(value, key, this)
      })
    },
    entries() {
      return btree.entries()
    },
    keys() {
      return btree.keys()
    },
    values() {
      return btree.values()
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map(btree.entries())
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    data: { enumerable: false },
    size: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

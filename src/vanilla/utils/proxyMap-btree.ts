import BTree from 'sorted-btree'
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
  const tree = proxy(btree)

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [k, v] of entries) {
      const key = maybeProxify(k)
      const value = maybeProxify(v)
      tree.set(key, value)
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    data: tree,
    get size() {
      return tree.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      return tree.get(k)
    },
    has(key: K) {
      const k = maybeProxify(key)
      return tree.has(k)
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
      tree.set(k, v)
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
      return tree.delete(k)
    },
    clear() {
      if (isImmutable(this)) {
        if (import.meta.env?.MODE !== 'production') {
          throw new Error('Cannot perform mutations on a snapshot')
        } else {
          return
        }
      }
      tree.clear()
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      tree.forEach((value: V, key: K) => {
        cb(value, key, this)
      })
    },
    entries() {
      return tree.entries()
    },
    keys() {
      return tree.keys()
    },
    values() {
      return tree.values()
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      return new Map(tree.entries())
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

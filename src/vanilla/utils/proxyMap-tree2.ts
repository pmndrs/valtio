import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap } = unstable_getInternalStates()
const isProxy = (x: any) => proxyStateMap.has(x)

let nextIndex = 0
const objectKeyMap = new WeakMap<object, number>()
const primitiveKeyMap = new Map<unknown, number>()
const getKeyIndex = (x: unknown) => {
  let index: number | undefined
  if (typeof x === 'object' && x !== null) {
    index = objectKeyMap.get(x)
    if (index === undefined) {
      index = nextIndex++
      objectKeyMap.set(x as object, index)
    }
  } else {
    index = primitiveKeyMap.get(x)
    if (index === undefined) {
      index = nextIndex++
      primitiveKeyMap.set(x, index)
    }
  }
  return index as number
}

const TREE_BASE = 100

type TreeNode = [
  indexes: (number | undefined)[],
  children: (TreeNode | undefined)[],
  values: (unknown | undefined)[],
  keys: (unknown | undefined)[],
  quotients: (number | undefined)[],
]

const createNewTreeNode = (): TreeNode => [[], [], [], [], []]

const insertIntoTreeNode = (
  node: TreeNode,
  index: number,
  key: unknown,
  value: unknown,
  index2 = index,
): boolean => {
  const [indexes, children, values, keys, quotients] = node
  const reminder = index2 % TREE_BASE
  const quotient = Math.floor(index2 / TREE_BASE)
  if (indexes[reminder] === index) {
    values[reminder] = value
    return false
  }
  let child = children[reminder]
  if (indexes[reminder] !== undefined && !child) {
    child = createNewTreeNode()
    insertIntoTreeNode(
      child,
      indexes[reminder]!,
      keys[reminder]!,
      values[reminder]!,
      quotients[reminder]!,
    )
    indexes[reminder] = undefined
    keys[reminder] = undefined
    quotients[reminder] = undefined
    values[reminder] = undefined
    children[reminder] = child
  }
  if (child) {
    return insertIntoTreeNode(child, index, key, value, quotient)
  }
  indexes[reminder] = index
  keys[reminder] = key
  values[reminder] = value
  quotients[reminder] = quotient
  return true
}

const EMPTY = Symbol()

const searchValueFromTreeNode = (
  node: TreeNode,
  index: number,
  index2 = index,
) => {
  const [indexes, children, values] = node
  const reminder = index2 % TREE_BASE
  const quotient = Math.floor(index2 / TREE_BASE)
  if (indexes[reminder] === index) {
    return values[reminder]
  }
  const child = children[reminder]
  if (child) {
    return searchValueFromTreeNode(child, index, quotient)
  }
  return EMPTY
}

const deleteFromTreeNode = (
  node: TreeNode,
  index: number,
  index2 = index,
): boolean => {
  // TODO shrink tree
  const [indexes, children, values, keys, quotients] = node
  const reminder = index2 % TREE_BASE
  const quotient = Math.floor(index2 / TREE_BASE)
  if (indexes[reminder] === index) {
    indexes[reminder] = undefined
    keys[reminder] = undefined
    values[reminder] = undefined
    quotients[reminder] = undefined
    return true
  }
  const child = children[index]
  if (child) {
    return deleteFromTreeNode(child, index, quotient)
  }
  return false
}

const walkTreeNode = (
  node: TreeNode,
  callback: (key: unknown, value: unknown) => void,
): void => {
  const [indexes, children, values, keys] = node
  for (let i = 0; i < TREE_BASE; i++) {
    if (indexes[i] !== undefined) {
      callback(keys[i], values[i])
    }
    const child = children[i]
    if (child) {
      walkTreeNode(child, callback)
    }
  }
}

type InternalProxyObject<K, V> = Map<K, V> & {
  root: TreeNode
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialRoot = createNewTreeNode()
  let size = 0

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [key, value] of entries) {
      const added = insertIntoTreeNode(
        initialRoot,
        getKeyIndex(key),
        key,
        value,
      )
      if (added) {
        size++
      }
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    root: initialRoot,
    get size() {
      return size
    },
    get(key: K) {
      const value = searchValueFromTreeNode(this.root, getKeyIndex(key))
      if (value === EMPTY) {
        return undefined
      }
      return value as V
    },
    has(key: K) {
      const value = searchValueFromTreeNode(this.root, getKeyIndex(key))
      return value !== EMPTY
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const added = insertIntoTreeNode(this.root, getKeyIndex(key), key, value)
      if (added) {
        size++
      }
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const deleted = deleteFromTreeNode(this.root, getKeyIndex(key))
      if (deleted) {
        size--
        return true
      }
      return false
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.root = createNewTreeNode()
      size = 0
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      walkTreeNode(this.root, (key, value) => {
        cb(value as V, key as K, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      // TODO improve with iterator
      const map = new Map<K, V>()
      walkTreeNode(this.root, (key, value) => {
        map.set(key as K, value as V)
      })
      for (const [key, value] of map) {
        yield [key, value]
      }
    },
    *keys(): IterableIterator<K> {
      // TODO improve with iterator
      const map = new Map<K, V>()
      walkTreeNode(this.root, (key, value) => {
        map.set(key as K, value as V)
      })
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      // TODO improve with iterator
      const map = new Map<K, V>()
      walkTreeNode(this.root, (key, value) => {
        map.set(key as K, value as V)
      })
      for (const value of map.values()) {
        yield value
      }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      const map = new Map<K, V>()
      walkTreeNode(this.root, (key, value) => {
        map.set(key as K, value as V)
      })
      return map
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(proxiedObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject as unknown as Map<K, V> & {
    $$valtioSnapshot: Omit<Map<K, V>, 'set' | 'delete' | 'clear'>
  }
}

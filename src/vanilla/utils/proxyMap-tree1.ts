import { proxy, unstable_getInternalStates } from '../../vanilla.ts'

const { proxyStateMap } = unstable_getInternalStates()
const maybeProxify = (x: any) => (typeof x === 'object' ? proxy({ x }).x : x)
const isProxy = (x: any) => proxyStateMap.has(x)

let nextKey = 0
const objectKeyMap = new WeakMap<object, number>()
const primitiveKeyMap = new Map<unknown, number>()
const getKey = (x: unknown) => {
  let key: number | undefined
  if (typeof x === 'object' && x !== null) {
    key = objectKeyMap.get(x)
    if (key === undefined) {
      key = nextKey++
      objectKeyMap.set(x as object, key)
    }
  } else {
    key = primitiveKeyMap.get(x)
    if (key === undefined) {
      key = nextKey++
      primitiveKeyMap.set(x, key)
    }
  }
  return key as number
}

const TREE_BASE = 1000

type TreeNode = [
  keys: (number | undefined)[],
  values: (unknown | undefined)[],
  children: (TreeNode | undefined)[],
  quotients: (number | undefined)[],
]

const createNewTreeNode = (): TreeNode => [[], [], [], []]

const insertIntoTreeNode = (
  node: TreeNode,
  key: number,
  value: unknown,
  key2 = key,
): boolean => {
  const [keys, values, children, quotients] = node
  const index = key2 % TREE_BASE
  const quotient = Math.floor(key2 / TREE_BASE)
  if (keys[index] === key) {
    values[index] = value
    return false
  }
  let child = children[index]
  if (keys[index] !== undefined && !child) {
    child = createNewTreeNode()
    insertIntoTreeNode(child, keys[index]!, values[index]!, quotients[index]!)
    keys[index] = undefined
    quotients[index] = undefined
    values[index] = undefined
    children[index] = child
  }
  if (child) {
    return insertIntoTreeNode(child, key, value, quotient)
  }
  keys[index] = key
  quotients[index] = quotient
  values[index] = value
  return true
}

const EMPTY = Symbol()

const searchFromTreeNode = (node: TreeNode, key: number, key2 = key) => {
  const [keys, values, children] = node
  const index = key2 % TREE_BASE
  const quotient = Math.floor(key2 / TREE_BASE)
  if (keys[index] === key) {
    return values[index]
  }
  const child = children[index]
  if (child) {
    return searchFromTreeNode(child, key, quotient)
  }
  return EMPTY
}

const deleteFromTreeNode = (
  node: TreeNode,
  key: number,
  key2 = key,
): boolean => {
  throw new Error('Not implemented')
}

type InternalProxyObject<K, V> = Map<K, V> & {
  root: TreeNode
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | undefined | null) {
  const initialRoot = createNewTreeNode()
  let initialSize = 0

  if (entries !== null && typeof entries !== 'undefined') {
    if (typeof entries[Symbol.iterator] !== 'function') {
      throw new TypeError(
        'proxyMap:\n\tinitial state must be iterable\n\t\ttip: structure should be [[key, value]]',
      )
    }
    for (const [key, value] of entries) {
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const added = insertIntoTreeNode(initialRoot, getKey(k), v)
      if (added) {
        initialSize++
      }
    }
  }

  const vObject: InternalProxyObject<K, V> = {
    root: initialRoot,
    size: initialSize,
    get(key: K) {
      const k = maybeProxify(key)
      const value = searchFromTreeNode(this.root, getKey(k))
      if (value === EMPTY) {
        return undefined
      }
      return value as V
    },
    has(key: K) {
      const k = maybeProxify(key)
      const value = searchFromTreeNode(this.root, getKey(k))
      return value !== EMPTY
    },
    set(key: K, value: V) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const added = insertIntoTreeNode(this.root, getKey(k), v)
      if (added) {
        this.size++
      }
      return this
    },
    delete(key: K) {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      const k = maybeProxify(key)
      const deleted = deleteFromTreeNode(this.root, getKey(k))
      if (deleted) {
        this.size--
        return true
      }
      return false
    },
    clear() {
      if (!isProxy(this)) {
        throw new Error('Cannot perform mutations on a snapshot')
      }
      this.root = createNewTreeNode()
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      // indexMap.forEach((index) => {
      //   cb(this.data[index + 1] as V, this.data[index] as K, this)
      // })
    },
    *entries(): MapIterator<[K, V]> {
      //for (const index of indexMap.values()) {
      //  yield [this.data[index], this.data[index + 1]] as [K, V]
      //}
    },
    *keys(): IterableIterator<K> {
      // for (const key of indexMap.keys()) {
      //   yield key
      // }
    },
    *values(): IterableIterator<V> {
      // for (const index of indexMap.values()) {
      //   yield this.data[index + 1] as V
      // }
    },
    [Symbol.iterator]() {
      return this.entries()
    },
    get [Symbol.toStringTag]() {
      return 'Map'
    },
    toJSON(): Map<K, V> {
      // return new Map([...indexMap].map(([k, i]) => [k, this.data[i + 1] as V]))
      return 'Not implemented' as never
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

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

/** Function type for any kind of function */
type AnyFunction = (...args: any[]) => any

/** Object that can be proxied */
type ProxyObject = object

/** Property access path as an array of property names/symbols */
type Path = (string | symbol)[]

/**
 * Operation performed on a proxy object
 * - 'set': A property was set to a new value
 * - 'delete': A property was deleted
 */
type Op =
  | [op: 'set', path: Path, value: unknown, prevValue: unknown]
  | [op: 'delete', path: Path, prevValue: unknown]

/** Function called when a proxy object changes */
type Listener = (op: Op | undefined, nextVersion: number) => void

export type INTERNAL_Op = Op

/** JavaScript primitive types */
type Primitive = string | number | boolean | null | undefined | symbol | bigint

/** Types that should not be proxied in snapshots */
type SnapshotIgnore =
  | Date
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | Error
  | RegExp
  | AnyFunction
  | Primitive

/**
 * Snapshot type that converts objects to readonly versions recursively
 */
export type Snapshot<T> = T extends { $$valtioSnapshot: infer S }
  ? S
  : T extends SnapshotIgnore
    ? T
    : T extends object
      ? { readonly [K in keyof T]: Snapshot<T[K]> }
      : T

type RemoveListener = () => void
type AddListener = (listener: Listener, internal?: boolean) => RemoveListener
type AddKeyListener = (
  key: string | symbol,
  listener: Listener,
  recursive?: boolean,
) => RemoveListener

type VersionNode = {
  index: number
  lowLink: number
  version: number
  update: (version: number) => void
}

type VersionContext = {
  index: number
  stack: VersionNode[]
  current?: VersionNode | undefined
}

type ProxyState = readonly [
  target: object,
  ensureVersion: (
    nextCheckVersion?: number,
    context?: VersionContext,
  ) => number,
  addListener: AddListener,
  addKeyListener: AddKeyListener,
  collectInvalidations: (
    nextVersion: number,
    visited: Set<object>,
    notifications: (() => void)[],
  ) => void,
  getKeyVersion: (key: string | symbol) => number,
]

type SnapCacheEntry = [version: number, snap: unknown]

const canProxyDefault = (x: unknown): boolean =>
  isObject(x) &&
  !refSet.has(x) &&
  (Array.isArray(x) || !(Symbol.iterator in x)) &&
  !(x instanceof WeakMap) &&
  !(x instanceof WeakSet) &&
  !(x instanceof Error) &&
  !(x instanceof Number) &&
  !(x instanceof Date) &&
  !(x instanceof String) &&
  !(x instanceof RegExp) &&
  !(x instanceof ArrayBuffer) &&
  !(x instanceof Promise)

const createSnapshotDefault = <T extends object>(
  target: T,
  version: number,
): T => {
  const cached = snapCache.get(target)
  if (cached?.[0] === version) {
    return cached[1] as T
  }
  const snap: any = Array.isArray(target)
    ? new Array(target.length)
    : Object.create(Object.getPrototypeOf(target))
  snapCache.set(target, [version, snap])
  Reflect.ownKeys(target).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(snap, key)) {
      // Only the known case is Array.length so far.
      return
    }
    const property = Reflect.getOwnPropertyDescriptor(
      target,
      key,
    ) as PropertyDescriptor
    if (property.get) {
      Object.defineProperty(snap, key, {
        get: property.get,
        enumerable: property.enumerable as boolean,
        configurable: true,
      })
      return
    }
    const value = Reflect.get(target, key)
    const desc: PropertyDescriptor = {
      value,
      enumerable: property.enumerable as boolean,
      configurable: true,
    }
    if (!refSet.has(value as object) && proxyStateMap.has(value as object)) {
      const [target, ensureVersion] = proxyStateMap.get(
        value as object,
      ) as ProxyState
      desc.value = createSnapshot(target, ensureVersion()) as Snapshot<T>
    }
    Object.defineProperty(snap, key, desc)
  })
  // Object.preventExtensions is removed. ref: https://github.com/pmndrs/valtio/pull/1220
  return snap
}

const hasSetter = (object: object, key: string | symbol) => {
  let current: object | null = object
  while (current) {
    const property = Reflect.getOwnPropertyDescriptor(current, key)
    if (property) {
      return !!property.set
    }
    current = Reflect.getPrototypeOf(current)
  }
  return false
}

const createHandlerDefault = <T extends object>(
  isInitializing: () => boolean,
  addChildListener: (key: string | symbol, value: unknown) => void,
  removeChildListener: (key: string | symbol) => void,
  notifyUpdate: (
    op: Op | undefined,
    key: string | symbol,
    extraKeys?: (string | symbol)[],
    detached?: unknown[],
  ) => void,
): ProxyHandler<T> => ({
  deleteProperty(target: T, key: string | symbol) {
    const property = Reflect.getOwnPropertyDescriptor(target, key)
    const prevValue = Reflect.get(target, key)
    const deleted = Reflect.deleteProperty(target, key)
    if (deleted) {
      removeChildListener(key)
      notifyUpdate(
        createOp?.('delete', key, prevValue),
        key,
        undefined,
        property && 'value' in property ? [property.value] : undefined,
      )
    }
    return deleted
  },
  set(target: T, key: string | symbol, value: any, receiver: object) {
    const initializing = isInitializing()
    const isForeignReceiver = receiver !== proxyCache.get(target)
    const isForeignDataWrite = isForeignReceiver && !hasSetter(target, key)
    const property = Reflect.getOwnPropertyDescriptor(target, key)
    const prevValue = Reflect.get(target, key, receiver)
    if (
      !initializing &&
      !isForeignReceiver &&
      property &&
      'value' in property &&
      (objectIs(prevValue, value) ||
        (!proxyStateMap.has(value) &&
          proxyCache.has(value) &&
          objectIs(prevValue, proxyCache.get(value))))
    ) {
      return true
    }
    const prevLength = Array.isArray(target) ? target.length : undefined
    const prevItems =
      Array.isArray(target) &&
      key === 'length' &&
      !(typeof value === 'number' && value >= target.length)
        ? Reflect.ownKeys(target).map(
            (key) =>
              [
                key,
                Reflect.getOwnPropertyDescriptor(target, key)?.value,
              ] as const,
          )
        : undefined
    const nextValue =
      !proxyStateMap.has(value) && canProxy(value) ? proxy(value) : value
    const result = Reflect.set(target, key, nextValue, receiver)
    const nextLength = Array.isArray(target) ? target.length : undefined
    if (!result && nextLength === prevLength) {
      return result
    }
    const nextProperty = Reflect.getOwnPropertyDescriptor(target, key)
    if (
      isForeignDataWrite &&
      nextLength === prevLength &&
      !!property === !!nextProperty &&
      objectIs(prevValue, Reflect.get(target, key, receiver))
    ) {
      return result
    }
    removeChildListener(key)
    if (nextProperty && 'value' in nextProperty) {
      addChildListener(key, nextProperty.value)
    }
    const detached: unknown[] = []
    if (
      !initializing &&
      property &&
      'value' in property &&
      !objectIs(property.value, nextProperty?.value)
    ) {
      detached.push(property.value)
    }
    let extraKeys: (string | symbol)[] | undefined
    if (prevItems && nextLength !== prevLength) {
      extraKeys = []
      prevItems.forEach(([key, value]) => {
        if (
          key !== 'length' &&
          !Reflect.getOwnPropertyDescriptor(target, key)
        ) {
          extraKeys!.push(key)
          removeChildListener(key)
          detached.push(value)
        }
      })
    } else if (key !== 'length' && nextLength !== prevLength) {
      extraKeys = ['length']
    }
    notifyUpdate(
      createOp?.('set', key, value, prevValue),
      key,
      extraKeys,
      detached,
    )
    return result
  },
})

const createOpDefault = (
  type: 'set' | 'delete',
  key: symbol | string,
  ...args: unknown[]
) => [type, [key], ...args] as Op

// internal states
const proxyStateMap: WeakMap<ProxyObject, ProxyState> = new WeakMap()
const refSet: WeakSet<object> = new WeakSet()
const snapCache: WeakMap<object, SnapCacheEntry> = new WeakMap()
const versionHolder = [1] as [number]
const proxyCache: WeakMap<object, ProxyObject> = new WeakMap()
let currentNotifications: Set<Listener> | undefined
const notifyListener = (
  listener: Listener,
  startVersion: number,
  nextVersion: number,
  op?: Op,
) => {
  if (startVersion < nextVersion && !currentNotifications?.has(listener)) {
    currentNotifications?.add(listener)
    listener(op, nextVersion)
  }
}

// internal functions
let objectIs: (a: unknown, b: unknown) => boolean = Object.is
let newProxy = <T extends object>(target: T, handler: ProxyHandler<T>): T =>
  new Proxy(target, handler)
let canProxy: typeof canProxyDefault = canProxyDefault
let createSnapshot: typeof createSnapshotDefault = createSnapshotDefault
let createHandler: typeof createHandlerDefault = createHandlerDefault
let createOp: typeof createOpDefault | undefined

/**
 * Creates a reactive proxy object that can be tracked for changes
 */
export function proxy<T extends object>(baseObject: T = {} as T): T {
  if (!isObject(baseObject)) {
    throw new Error('object required')
  }
  const found = proxyCache.get(baseObject) as T | undefined
  if (found) {
    return found
  }
  let version = versionHolder[0]
  let notifiedVersion = version
  const listeners = new Map<Listener, number>()
  let internalListeners: Map<Listener, number> | undefined
  const keyListeners = new Map<string | symbol, Map<Listener, number>>()
  const branchListeners = new Map<string | symbol, Map<Listener, number>>()
  let keyVersions: Map<string | symbol, number> | undefined
  const getKeyVersion = (key: string | symbol) => {
    keyVersions ||= new Map()
    if (!keyVersions.has(key)) keyVersions.set(key, versionHolder[0])
    return keyVersions.get(key)!
  }
  const notifyUpdate = (
    op: Op | undefined,
    nextVersion = ++versionHolder[0],
    key?: string | symbol,
    extraKeys?: (string | symbol)[],
    childKey?: string | symbol,
  ) => {
    if (keyVersions && key !== undefined) {
      if (keyVersions.has(key)) keyVersions.set(key, nextVersion)
      extraKeys?.forEach((key) => {
        if (keyVersions!.has(key)) keyVersions!.set(key, nextVersion)
      })
    }
    if (version < nextVersion) {
      checkVersion = version = nextVersion
    }
    if (notifiedVersion !== nextVersion) {
      notifiedVersion = nextVersion
      internalListeners?.forEach((startVersion, listener) => {
        notifyListener(listener, startVersion, nextVersion, op)
      })
      listeners.forEach((startVersion, listener) => {
        notifyListener(listener, startVersion, nextVersion, op)
      })
    }
    const notifyBranch = (key: string | symbol) => {
      branchListeners.get(key)?.forEach((startVersion, listener) => {
        notifyListener(listener, startVersion, nextVersion, op)
      })
    }
    if (childKey !== undefined) {
      notifyBranch(childKey)
    }
    if (key !== undefined) {
      const notifyKey = (key: string | symbol) => {
        keyListeners.get(key)?.forEach((startVersion, listener) => {
          notifyListener(listener, startVersion, nextVersion, op)
        })
        notifyBranch(key)
      }
      notifyKey(key)
      extraKeys?.forEach(notifyKey)
    }
  }
  const collectInvalidations = (
    nextVersion: number,
    visited: Set<object>,
    notifications: (() => void)[],
  ) => {
    if (visited.has(baseObject)) {
      return
    }
    visited.add(baseObject)
    notifications.push(() => {
      const notify = (startVersion: number, listener: Listener) => {
        notifyListener(listener, startVersion, nextVersion)
      }
      listeners.forEach(notify)
      keyListeners.forEach((listeners) => listeners.forEach(notify))
      branchListeners.forEach((listeners) => listeners.forEach(notify))
    })
    childProxyStates.forEach(([childProxyState]) => {
      const [, , , , collect] = childProxyState
      collect(nextVersion, visited, notifications)
    })
  }
  let checkVersion = version
  // Finalize mutually reachable targets together after checking every branch.
  let versionNode: VersionNode | undefined
  const ensureVersion = (
    nextCheckVersion = versionHolder[0],
    context?: VersionContext,
  ) => {
    if (checkVersion === nextCheckVersion && !versionNode) {
      return version
    }
    const parent = context?.current
    if (checkVersion !== nextCheckVersion) {
      checkVersion = nextCheckVersion
      if (!childProxyStates.size) {
        return version
      }
      const versionContext: VersionContext = context || { index: 0, stack: [] }
      const index = versionContext.index++
      const node = (versionNode = {
        index,
        lowLink: index,
        version,
        update: (nextVersion: number) => {
          version = nextVersion
          versionNode = undefined
        },
      })
      const stackIndex = versionContext.stack.length
      versionContext.stack.push(node)
      versionContext.current = node
      childProxyStates.forEach(([childProxyState]) => {
        const childVersion = childProxyState[1](
          nextCheckVersion,
          versionContext,
        )
        node.version = Math.max(node.version, childVersion)
      })
      if (node.lowLink === node.index) {
        let componentVersion = node.version
        for (let i = stackIndex; i < versionContext.stack.length; i++) {
          componentVersion = Math.max(
            componentVersion,
            versionContext.stack[i]!.version,
          )
        }
        while (versionContext.stack.length > stackIndex) {
          const member = versionContext.stack.pop()!
          member.update(componentVersion)
        }
      }
      versionContext.current = parent
      if (parent && versionNode) {
        parent.lowLink = Math.min(parent.lowLink, node.lowLink)
      }
    } else if (parent && versionNode) {
      parent.lowLink = Math.min(parent.lowLink, versionNode.index)
    }
    return version
  }
  const createChildListener =
    (key: string | symbol): Listener =>
    (op, nextVersion) => {
      let newOp: Op | undefined
      if (op) {
        newOp = [...op]
        newOp[1] = [key, ...(newOp[1] as Path)]
      }
      notifyUpdate(newOp, nextVersion, undefined, undefined, key)
    }
  const childProxyStates = new Map<
    string | symbol,
    readonly [ProxyState, RemoveListener?]
  >()
  const addChildListener = (key: string | symbol, value: unknown) => {
    const childProxyState =
      !refSet.has(value as object) && proxyStateMap.get(value as object)
    if (childProxyState) {
      if (process.env.NODE_ENV !== 'production' && childProxyStates.has(key)) {
        throw new Error('child listener exists')
      }
      if (
        listeners.size ||
        internalListeners?.size ||
        branchListeners.has(key)
      ) {
        const remove = childProxyState[2](createChildListener(key), true)
        childProxyStates.set(key, [childProxyState, remove])
      } else {
        childProxyStates.set(key, [childProxyState])
      }
    }
  }
  const removeChildListener = (key: string | symbol) => {
    const entry = childProxyStates.get(key)
    if (entry) {
      childProxyStates.delete(key)
      entry[1]?.()
    }
  }
  const addListener = (listener: Listener, internal?: boolean) => {
    const listenerMap = internal ? (internalListeners ||= new Map()) : listeners
    const hadListeners = listeners.size || internalListeners?.size
    listenerMap.set(listener, versionHolder[0])
    if (!hadListeners) {
      childProxyStates.forEach(([childProxyState, prevRemove], key) => {
        if (prevRemove) {
          return
        }
        const remove = childProxyState[2](createChildListener(key), true)
        childProxyStates.set(key, [childProxyState, remove])
      })
    }
    const removeListener = () => {
      listenerMap.delete(listener)
      if (!listeners.size && !internalListeners?.size) {
        childProxyStates.forEach(([childProxyState, remove], key) => {
          if (remove && !branchListeners.has(key)) {
            remove()
            childProxyStates.set(key, [childProxyState])
          }
        })
      }
    }
    return removeListener
  }
  const addKeyListener: AddKeyListener = (key, listener, recursive) => {
    const listenerMaps = recursive ? branchListeners : keyListeners
    let keyListenerMap = listenerMaps.get(key)
    if (!keyListenerMap) {
      keyListenerMap = new Map()
      listenerMaps.set(key, keyListenerMap)
    }
    keyListenerMap.set(listener, versionHolder[0])
    const child = childProxyStates.get(key)
    if (recursive && child && !child[1]) {
      const [childProxyState] = child
      childProxyStates.set(key, [
        childProxyState,
        childProxyState[2](createChildListener(key), true),
      ])
    }
    return () => {
      keyListenerMap.delete(listener)
      if (!keyListenerMap.size && listenerMaps.get(key) === keyListenerMap) {
        listenerMaps.delete(key)
        if (recursive && !listeners.size && !internalListeners?.size) {
          const child = childProxyStates.get(key)
          if (child) {
            child[1]?.()
            childProxyStates.set(key, [child[0]])
          }
        }
      }
    }
  }
  let initializing = true
  const handler = createHandler<T>(
    () => initializing,
    addChildListener,
    removeChildListener,
    (op, key, extraKeys, detached) => {
      const nextVersion = ++versionHolder[0]
      const visited = new Set<object>()
      const notifications: (() => void)[] = []
      detached?.forEach((value) => {
        const state =
          !refSet.has(value as object) && proxyStateMap.get(value as object)
        if (state) {
          const [, , , , collect] = state
          collect(nextVersion, visited, notifications)
        }
      })
      const previousNotifications = currentNotifications
      currentNotifications = new Set()
      try {
        notifyUpdate(op, nextVersion, key, extraKeys)
        notifications.forEach((notify) => notify())
      } finally {
        currentNotifications = previousNotifications
      }
    },
  )
  const proxyObject = newProxy(baseObject, handler)
  proxyCache.set(baseObject, proxyObject)
  const proxyState: ProxyState = [
    baseObject,
    ensureVersion,
    addListener,
    addKeyListener,
    collectInvalidations,
    getKeyVersion,
  ]
  proxyStateMap.set(proxyObject, proxyState)
  Reflect.ownKeys(baseObject).forEach((key) => {
    const desc = Object.getOwnPropertyDescriptor(
      baseObject,
      key,
    ) as PropertyDescriptor
    if ('value' in desc && desc.writable) {
      proxyObject[key as keyof T] = baseObject[key as keyof T]
    } else if ('value' in desc) {
      addChildListener(key, desc.value)
    }
  })
  initializing = false
  return proxyObject
}

export function isProxyObject(value: unknown): boolean {
  return proxyStateMap.has(value as object)
}

/**
 * Gets the current version number of a proxy object
 */
export function getVersion(
  proxyObject: unknown,
  key?: PropertyKey,
): number | undefined {
  const proxyState = proxyStateMap.get(proxyObject as object)
  return key === undefined
    ? proxyState?.[1]()
    : proxyState?.[5](normalizeKey(key))
}

type SubscribeOptions<T extends object> = {
  recursive?: boolean
  keys?: readonly (keyof T)[]
  sync?: boolean | undefined
}

const normalizeKey = (key: PropertyKey): string | symbol =>
  typeof key === 'symbol' ? key : String(key)

/**
 * Subscribes to changes in a proxy object
 */
export function subscribe<T extends object>(
  proxyObject: T,
  callback: (unstable_ops: Op[]) => void,
  notifyInSyncOrOptions?: boolean | SubscribeOptions<T>,
): () => void {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (process.env.NODE_ENV !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const notifyInSync =
    typeof notifyInSyncOrOptions === 'boolean'
      ? notifyInSyncOrOptions
      : notifyInSyncOrOptions?.sync
  const keys =
    typeof notifyInSyncOrOptions === 'object'
      ? notifyInSyncOrOptions.keys
      : undefined
  let promise: Promise<void> | undefined
  const ops: Op[] = []
  let isListenerActive = true
  const listener: Listener = (op) => {
    if (op) {
      ops.push(op)
    }
    if (notifyInSync) {
      callback(ops.splice(0))
      return
    }
    if (!promise) {
      promise = Promise.resolve().then(() => {
        promise = undefined
        if (isListenerActive) {
          callback(ops.splice(0))
        }
      })
    }
  }
  const removeListeners = keys
    ? [...new Set(keys.map((key) => normalizeKey(key)))].map((key) =>
        (proxyState as ProxyState)[3](
          key,
          listener,
          typeof notifyInSyncOrOptions === 'object' &&
            notifyInSyncOrOptions.recursive === false
            ? false
            : true,
        ),
      )
    : [(proxyState as ProxyState)[2](listener)]
  return () => {
    isListenerActive = false
    removeListeners.forEach((removeListener) => removeListener())
  }
}

/**
 * Creates an immutable snapshot of the current state of a proxy object
 */
export function snapshot<T extends object>(proxyObject: T): Snapshot<T> {
  const proxyState = proxyStateMap.get(proxyObject as object)
  if (process.env.NODE_ENV !== 'production' && !proxyState) {
    console.warn('Please use proxy object')
  }
  const [target, ensureVersion] = proxyState as ProxyState
  return createSnapshot(target, ensureVersion()) as Snapshot<T>
}

/**
 * Marks an object to be excluded from proxying
 *
 * Objects marked with ref will be kept as references in snapshots
 * instead of being deeply copied.
 */
export function ref<T extends object>(obj: T) {
  refSet.add(obj)
  return obj as T & { $$valtioSnapshot: T }
}

// ------------------------------------------------
// unstable APIs (subject to change without notice)
// ------------------------------------------------

export function unstable_getInternalStates(): {
  proxyStateMap: typeof proxyStateMap
  refSet: typeof refSet
  snapCache: typeof snapCache
  versionHolder: typeof versionHolder
  proxyCache: typeof proxyCache
} {
  return {
    proxyStateMap,
    refSet,
    snapCache,
    versionHolder,
    proxyCache,
  }
}

export function unstable_replaceInternalFunction(
  name: 'objectIs',
  fn: (prev: typeof objectIs) => typeof objectIs,
): void

export function unstable_replaceInternalFunction(
  name: 'newProxy',
  fn: (prev: typeof newProxy) => typeof newProxy,
): void

export function unstable_replaceInternalFunction(
  name: 'canProxy',
  fn: (prev: typeof canProxy) => typeof canProxy,
): void

export function unstable_replaceInternalFunction(
  name: 'createSnapshot',
  fn: (prev: typeof createSnapshot) => typeof createSnapshot,
): void

export function unstable_replaceInternalFunction(
  name: 'createHandler',
  fn: (prev: typeof createHandler) => typeof createHandler,
): void

export function unstable_replaceInternalFunction(
  name:
    | 'objectIs'
    | 'newProxy'
    | 'canProxy'
    | 'createSnapshot'
    | 'createHandler',
  fn: (prev: any) => any,
) {
  switch (name) {
    case 'objectIs':
      objectIs = fn(objectIs)
      break
    case 'newProxy':
      newProxy = fn(newProxy)
      break
    case 'canProxy':
      canProxy = fn(canProxy)
      break
    case 'createSnapshot':
      createSnapshot = fn(createSnapshot)
      break
    case 'createHandler':
      createHandler = fn(createHandler)
      break
    default:
      throw new Error('unknown function')
  }
}

export function unstable_enableOp(
  enabled: boolean | typeof createOpDefault = true,
): void {
  if (enabled === true) {
    createOp = createOpDefault
  } else if (enabled === false) {
    createOp = undefined
  } else {
    createOp = enabled
  }
}

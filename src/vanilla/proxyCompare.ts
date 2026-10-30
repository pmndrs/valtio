// Embedded from proxy-compare 3.0.1, keeping only what Valtio uses.
// It is internal: vanilla marks and unwraps with it, and useSnapshot tracks
// reads and compares snapshots with it.
//
// proxy-compare is licensed under the MIT License:
//
// Copyright (c) 2020 Daishi Kato
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/* eslint @typescript-eslint/no-explicit-any: off */

// symbols
const TRACK_MEMO_SYMBOL = Symbol()
const GET_ORIGINAL_SYMBOL = Symbol()

// properties
const AFFECTED_PROPERTY = 'a'
const IS_TARGET_COPIED_PROPERTY = 'f'
const PROXY_PROPERTY = 'p'
const PROXY_CACHE_PROPERTY = 'c'
const TARGET_CACHE_PROPERTY = 't'
const HAS_KEY_PROPERTY = 'h'
const ALL_OWN_KEYS_PROPERTY = 'w'
const HAS_OWN_KEY_PROPERTY = 'o'
const KEYS_PROPERTY = 'k'

// get object prototype
const getProto = Object.getPrototypeOf

const objectsToTrack = new WeakMap<object, boolean>()

// check if obj is a plain object or an array
const isObjectToTrack = <T>(obj: T): obj is T extends object ? T : never =>
  obj &&
  (objectsToTrack.has(obj as unknown as object)
    ? (objectsToTrack.get(obj as unknown as object) as boolean)
    : getProto(obj) === Object.prototype || getProto(obj) === Array.prototype)

// check if it is object
const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

// Properties that are both non-configurable and non-writable will break
// the proxy get trap when we try to return a recursive/child compare proxy
// from them. We can avoid this by making a copy of the target object with
// all descriptors marked as configurable, see `copyTargetObject`.
// See: https://github.com/dai-shi/proxy-compare/pull/8
const needsToCopyTargetObject = (obj: object) =>
  Object.values(Object.getOwnPropertyDescriptors(obj)).some(
    (descriptor) => !descriptor.configurable && !descriptor.writable,
  )

// Make a copy with all descriptors marked as configurable.
const copyTargetObject = <T extends object>(obj: T): T => {
  if (Array.isArray(obj)) {
    // Arrays need a special way to copy
    return Array.from(obj) as T
  }
  // For non-array objects, we create a new object keeping the prototype
  // with changing all configurable options (otherwise, proxies will complain)
  const descriptors = Object.getOwnPropertyDescriptors(obj)
  Object.values(descriptors).forEach((desc) => {
    desc.configurable = true
  })
  return Object.create(getProto(obj), descriptors)
}

type HasKeySet = Set<string | symbol>
type HasOwnKeySet = Set<string | symbol>
type KeysSet = Set<string | symbol>
type Used = {
  [HAS_KEY_PROPERTY]?: HasKeySet
  [ALL_OWN_KEYS_PROPERTY]?: true
  [HAS_OWN_KEY_PROPERTY]?: HasOwnKeySet
  [KEYS_PROPERTY]?: KeysSet
}
type Affected = WeakMap<object, Used>
type ProxyHandlerState<T extends object> = {
  readonly [IS_TARGET_COPIED_PROPERTY]: boolean
  [PROXY_PROPERTY]?: T
  [PROXY_CACHE_PROPERTY]?: ProxyCache<object>
  [TARGET_CACHE_PROPERTY]?: TargetCache<object>
  [AFFECTED_PROPERTY]?: Affected
}
type ProxyCache<T extends object> = WeakMap<
  object,
  readonly [ProxyHandler<T>, ProxyHandlerState<T>]
>
type TargetCache<T extends object> = WeakMap<
  object,
  readonly [target: T, copiedTarget?: T]
>

const createProxyHandler = <T extends object>(
  origObj: T,
  isTargetCopied: boolean,
) => {
  const state: ProxyHandlerState<T> = {
    [IS_TARGET_COPIED_PROPERTY]: isTargetCopied,
  }
  let trackObject = false // for trackMemo
  const recordUsage = (
    type:
      | typeof HAS_KEY_PROPERTY
      | typeof ALL_OWN_KEYS_PROPERTY
      | typeof HAS_OWN_KEY_PROPERTY
      | typeof KEYS_PROPERTY,
    key?: string | symbol,
  ) => {
    if (!trackObject) {
      let used = (state[AFFECTED_PROPERTY] as Affected).get(origObj)
      if (!used) {
        used = {}
        ;(state[AFFECTED_PROPERTY] as Affected).set(origObj, used)
      }
      if (type === ALL_OWN_KEYS_PROPERTY) {
        used[ALL_OWN_KEYS_PROPERTY] = true
      } else {
        let set = used[type]
        if (!set) {
          set = new Set()
          used[type] = set
        }
        set.add(key as string | symbol)
      }
    }
  }
  const recordObjectAsUsed = () => {
    trackObject = true
    ;(state[AFFECTED_PROPERTY] as Affected).delete(origObj)
  }
  const handler: ProxyHandler<T> = {
    get(target, key) {
      if (key === GET_ORIGINAL_SYMBOL) {
        return origObj
      }
      recordUsage(KEYS_PROPERTY, key)
      return createProxy(
        Reflect.get(target, key),
        state[AFFECTED_PROPERTY] as Affected,
        state[PROXY_CACHE_PROPERTY] as ProxyCache<object>,
        state[TARGET_CACHE_PROPERTY] as TargetCache<object>,
      )
    },
    has(target, key) {
      if (key === TRACK_MEMO_SYMBOL) {
        recordObjectAsUsed()
        return true
      }
      recordUsage(HAS_KEY_PROPERTY, key)
      return Reflect.has(target, key)
    },
    getOwnPropertyDescriptor(target, key) {
      recordUsage(HAS_OWN_KEY_PROPERTY, key)
      return Reflect.getOwnPropertyDescriptor(target, key)
    },
    ownKeys(target) {
      recordUsage(ALL_OWN_KEYS_PROPERTY)
      return Reflect.ownKeys(target)
    },
  }
  if (isTargetCopied) {
    handler.set = handler.deleteProperty = () => false
  }
  return [handler, state] as const
}

const getOriginalObject = <T extends object>(obj: T) =>
  // unwrap proxy
  (obj as { [GET_ORIGINAL_SYMBOL]?: typeof obj })[GET_ORIGINAL_SYMBOL] ||
  // otherwise
  obj

/**
 * Wraps obj in a proxy that records the properties read into affected.
 * Nested objects are wrapped as they are read.
 */
export const createProxy = <T>(
  obj: T,
  affected: WeakMap<object, unknown>,
  proxyCache: WeakMap<object, unknown>,
  targetCache: WeakMap<object, unknown>,
): T => {
  if (!isObjectToTrack(obj)) return obj
  let targetAndCopied = (targetCache as TargetCache<typeof obj>).get(obj)
  if (!targetAndCopied) {
    const target = getOriginalObject(obj)
    if (needsToCopyTargetObject(target)) {
      targetAndCopied = [target, copyTargetObject(target)]
    } else {
      targetAndCopied = [target]
    }
    targetCache.set(obj, targetAndCopied)
  }
  const [target, copiedTarget] = targetAndCopied
  let handlerAndState = (proxyCache as ProxyCache<typeof target>).get(target)
  if (
    !handlerAndState ||
    handlerAndState[1][IS_TARGET_COPIED_PROPERTY] !== !!copiedTarget
  ) {
    handlerAndState = createProxyHandler<typeof target>(target, !!copiedTarget)
    handlerAndState[1][PROXY_PROPERTY] = new Proxy(
      copiedTarget || target,
      handlerAndState[0],
    )
    proxyCache.set(target, handlerAndState)
  }
  handlerAndState[1][AFFECTED_PROPERTY] = affected as Affected
  handlerAndState[1][PROXY_CACHE_PROPERTY] = proxyCache as ProxyCache<object>
  handlerAndState[1][TARGET_CACHE_PROPERTY] = targetCache as TargetCache<object>
  return handlerAndState[1][PROXY_PROPERTY] as typeof target
}

const isAllOwnKeysChanged = (prevObj: object, nextObj: object) => {
  const prevKeys = Reflect.ownKeys(prevObj)
  const nextKeys = Reflect.ownKeys(nextObj)
  return (
    prevKeys.length !== nextKeys.length ||
    prevKeys.some((k, i) => k !== nextKeys[i])
  )
}

/**
 * Compares the properties recorded in affected between prevObj and nextObj.
 * An object with nothing recorded is compared by identity.
 */
export const isChanged = (
  prevObj: unknown,
  nextObj: unknown,
  affected: WeakMap<object, unknown>,
  cache: WeakMap<object, unknown>, // for object with cycles
): boolean => {
  if (Object.is(prevObj, nextObj)) {
    return false
  }
  if (!isObject(prevObj) || !isObject(nextObj)) return true
  const used = (affected as Affected).get(getOriginalObject(prevObj))
  if (!used) return true
  const hit = cache.get(prevObj)
  if (hit === nextObj) {
    return false
  }
  // for object with cycles
  cache.set(prevObj, nextObj)
  let changed: boolean | null = null
  for (const key of used[HAS_KEY_PROPERTY] || []) {
    changed = Reflect.has(prevObj, key) !== Reflect.has(nextObj, key)
    if (changed) return changed
  }
  if (used[ALL_OWN_KEYS_PROPERTY] === true) {
    changed = isAllOwnKeysChanged(prevObj, nextObj)
    if (changed) return changed
  } else {
    for (const key of used[HAS_OWN_KEY_PROPERTY] || []) {
      const hasPrev = !!Reflect.getOwnPropertyDescriptor(prevObj, key)
      const hasNext = !!Reflect.getOwnPropertyDescriptor(nextObj, key)
      changed = hasPrev !== hasNext
      if (changed) return changed
    }
  }
  for (const key of used[KEYS_PROPERTY] || []) {
    changed = isChanged(
      (prevObj as any)[key],
      (nextObj as any)[key],
      affected,
      cache,
    )
    if (changed) return changed
  }
  if (changed === null) throw new Error('invalid used')
  return changed
}

/**
 * Marks obj, read through a tracked proxy, as used as a whole,
 * so that a change to its identity is detected.
 */
export const trackMemo = (obj: unknown): boolean => {
  if (isObjectToTrack(obj)) {
    return TRACK_MEMO_SYMBOL in obj
  }
  return false
}

/**
 * Returns the object wrapped by a tracked proxy, or null.
 */
export const getUntracked = <T>(obj: T): T | null => {
  if (isObjectToTrack(obj)) {
    return (obj as { [GET_ORIGINAL_SYMBOL]?: T })[GET_ORIGINAL_SYMBOL] || null
  }
  return null
}

/**
 * Marks obj to be wrapped by createProxy or not. By default, only plain
 * objects and arrays are wrapped.
 */
export const markToTrack = (obj: object, mark = true): void => {
  objectsToTrack.set(obj, mark)
}

/**
 * Converts affected into a printable list of paths, for debugging.
 * Getters are left out.
 */
export const affectedToPathList = (
  obj: unknown,
  affected: WeakMap<object, unknown>,
): (string | symbol)[][] => {
  const list: (string | symbol)[][] = []
  const seen = new WeakSet()
  const walk = (x: unknown, path?: (string | symbol)[]) => {
    if (seen.has(x as object)) {
      // for object with cycles
      return
    }
    if (isObject(x)) {
      seen.add(x)
    }
    const used = isObject(x) && (affected as Affected).get(getOriginalObject(x))
    if (used) {
      used[HAS_KEY_PROPERTY]?.forEach((key) => {
        const segment = `:has(${String(key)})`
        list.push(path ? [...path, segment] : [segment])
      })
      if (used[ALL_OWN_KEYS_PROPERTY] === true) {
        const segment = ':ownKeys'
        list.push(path ? [...path, segment] : [segment])
      } else {
        used[HAS_OWN_KEY_PROPERTY]?.forEach((key) => {
          const segment = `:hasOwn(${String(key)})`
          list.push(path ? [...path, segment] : [segment])
        })
      }
      used[KEYS_PROPERTY]?.forEach((key) => {
        if ('value' in (Object.getOwnPropertyDescriptor(x, key) || {})) {
          walk((x as any)[key], path ? [...path, key] : [key])
        }
      })
    } else if (path) {
      list.push(path)
    }
  }
  walk(obj)
  return list
}

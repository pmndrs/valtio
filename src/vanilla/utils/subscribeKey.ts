import { subscribe } from '../../vanilla.js'

const hasGetter = (obj: object, key: string | symbol): boolean => {
  for (let o: object | null = obj; o; o = Object.getPrototypeOf(o)) {
    if (Reflect.getOwnPropertyDescriptor(o, key)?.get) {
      return true
    }
  }
  return false
}

/**
 * subscribeKey
 *
 * The subscribeKey utility enables subscription to a primitive subproperty of a given state proxy.
 * Subscriptions created with subscribeKey will only fire when the specified property changes.
 * Like subscribe(), the callback runs synchronously; use batch() to group changes.
 *
 * @example
 * import { subscribeKey } from 'valtio/utils'
 * subscribeKey(state, 'count', (v) => console.log('state.count has changed to', v))
 */
export function subscribeKey<T extends object, K extends keyof T>(
  proxyObject: T,
  key: K,
  callback: (value: T[K]) => void,
): () => void {
  // eslint-disable-next-line prefer-rest-params
  if (typeof arguments[3] === 'boolean') {
    throw new Error(
      'notifyInSync has been removed. subscribeKey() is synchronous. Use batch() to group notifications.',
    )
  }
  const propertyKey =
    typeof key === 'number' ? String(key) : (key as string | symbol)
  let prevValue = proxyObject[key]
  return subscribe(
    proxyObject,
    () => {
      const nextValue = proxyObject[key]
      if (!Object.is(prevValue, nextValue)) {
        callback((prevValue = nextValue))
      }
    },
    // A getter can read any key, so it needs every write in the subtree.
    hasGetter(proxyObject, propertyKey) ? undefined : { keys: [propertyKey] },
  )
}

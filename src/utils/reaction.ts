import {
  PROXY_IDENTITY,
  PROXY_STATE,
  ProxyObject,
  getTrackedProxies,
  startTracking,
  stopTracking,
  subscribe,
} from '../vanilla'
import { subscribeKey } from './subscribeKey'

type Cleanup = () => void
type ReactionCallback = () => any

type ReactionOptions = {
  sync?: boolean
}

let currentCleanups: Set<Cleanup> | undefined

export type Reaction = {
  cleanup: Cleanup
  track: (trackCallback: () => any) => void
}

/**
 * reaction
 *
 * Creates a reactive effect that is invoked when a tracked proxy is updated.
 * It returns a cleanup function to stop the reactive effect from reevaluating,
 * and a track functon which should be invoked with a callback that uses proxies.
 * Any proxy used by the track callback function will be automatically tracked.
 *
 * Unlike `watch` the callback is only invoked when a tracked proxy is changed.
 *
 * Track callbacks may return an optional cleanup function, which is evaluated
 * whenever `track` is called again or when the cleanup function returned by
 * `reaction` is evaluated.
 *
 * @param callback to be invoked as an effect when tracked data changes
 * @returns An object containing a `cleanup` function that stops the tracking and
 * performs tracking cleanups, and a `track` function which can be passed a
 * callback to track data for changes.
 */
export function reaction(
  callback: ReactionCallback,
  options?: ReactionOptions
): Reaction {
  let alive = true
  const cleanups = new Set<Cleanup>()

  type Unsubscribe = () => void
  const subscriptions = new Map<[ProxyObject, string | symbol], Unsubscribe>()

  const cleanup = () => {
    if (alive) {
      alive = false
      cleanups.forEach((clean) => clean())
      cleanups.clear()
      subscriptions.forEach((unsubscribe) => unsubscribe())
      subscriptions.clear()
    }
  }

  const revalidate = (trackCallback: () => any) => {
    if (!alive) {
      return
    }
    cleanups.forEach((clean) => clean())
    cleanups.clear()

    // Setup watch context, this allows us to automatically capture
    // watch cleanups if the watch callback itself has watch calls.
    const parent = currentCleanups
    currentCleanups = cleanups

    startTracking()

    // Ensures that the parent is reset if the callback throws an error.
    try {
      let cleanupReturn

      // Invoke the tracking function to build our dependencies
      cleanupReturn = trackCallback()

      // If there's a cleanup, we add this to the cleanups set
      if (cleanupReturn) {
        cleanups.add(cleanupReturn)
      }
    } finally {
      currentCleanups = parent
      stopTracking()
    }

    // Get a copy of the tracked proxies
    const proxiesToSubscribe = new Set(getTrackedProxies())

    // Unsubscribe old subscriptions
    subscriptions.forEach((unsubscribe, proxyObject) => {
      if (proxiesToSubscribe.has(proxyObject)) {
        // Already subscribed
        proxiesToSubscribe.delete(proxyObject)
      } else {
        subscriptions.delete(proxyObject)
        unsubscribe()
      }
    })

    // Subscribe to new proxies
    proxiesToSubscribe.forEach((proxyObject) => {
      const [proxyObj, key] = proxyObject
      const target = (proxyObj as any)[PROXY_IDENTITY]
      let unsubscribe
      if (typeof target[key] !== 'object') {
        // primitive value so subscribe with key
        unsubscribe = subscribeKey(
          proxyObj,
          key as keyof typeof proxyObj,
          callback,
          options?.sync
        )
      } else {
        // not a proxy? don't try to subscribe
        if (!proxyObj[key as keyof typeof proxyObj][PROXY_STATE]) {
          return
        }
        // otherwise its a proxy so subscribe and use the ops to determine
        // if the property we care about has actually changed
        unsubscribe = subscribe(
          proxyObj,
          (ops) => {
            ops.forEach(([_type, props, _value, _prevValue]) => {
              if (props[0] === key) {
                callback()
              }
            })
          },
          options?.sync
        )
      }
      subscriptions.set(proxyObject, unsubscribe)
    })
  }

  // If there's a parent watch call, we attach this watch's
  // cleanup to the parent.
  if (currentCleanups) {
    currentCleanups.add(cleanup)
  }

  return {
    track: revalidate,
    cleanup,
  }
}

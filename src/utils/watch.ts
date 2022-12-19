import {
  getTrackedProxies,
  startTracking,
  stopTracking,
  subscribe,
} from '../vanilla'

type Cleanup = () => void
type ReactionCallback = () => any

type WatchGet = <T extends object>(proxyObject: T) => T
type WatchCallback = (get: WatchGet) => Cleanup | void | undefined
type WatchOptions = {
  sync?: boolean
}

let currentCleanups: Set<Cleanup> | undefined

export type Reaction = {
  dispose: Cleanup
  track: (trackCallback: () => any) => void
}

function reactionInternal(
  callback: ReactionCallback | WatchCallback,
  useTracking = true,
  options?: WatchOptions
): Reaction {
  let alive = true
  const cleanups = new Set<Cleanup>()

  type ProxyObject = object
  type Unsubscribe = () => void
  const subscriptions = new Map<ProxyObject, Unsubscribe>()

  const cleanup = () => {
    if (alive) {
      alive = false
      cleanups.forEach((clean) => clean())
      cleanups.clear()
      subscriptions.forEach((unsubscribe) => unsubscribe())
      subscriptions.clear()
    }
  }

  const revalidate = (trackCallback?: () => any) => {
    if (!alive) {
      return
    }
    cleanups.forEach((clean) => clean())
    cleanups.clear()

    const proxiesToSubscribe = new Set<ProxyObject>()

    // Setup watch context, this allows us to automatically capture
    // watch cleanups if the watch callback itself has watch calls.
    const parent = currentCleanups
    currentCleanups = cleanups

    if (trackCallback) {
      startTracking()
    }
    // Ensures that the parent is reset if the callback throws an error.
    try {
      let cleanupReturn
      if (trackCallback) {
        // Invoke the tracking function to build our dependencies
        cleanupReturn = trackCallback()
        // Then subscribe to each of them
        getTrackedProxies().forEach((value) => {
          proxiesToSubscribe.add(value)
        })
      } else {
        // With manual tracking invoke the callback with the getter
        cleanupReturn = callback((proxyObject) => {
          proxiesToSubscribe.add(proxyObject)
          return proxyObject
        })
      }

      // If there's a cleanup, we add this to the cleanups set
      if (cleanupReturn) {
        cleanups.add(cleanupReturn)
      }
    } finally {
      currentCleanups = parent
      stopTracking()
    }

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
      const cb: () => any = useTracking
        ? (callback as ReactionCallback)
        : () => revalidate()
      const unsubscribe = subscribe(proxyObject, cb, options?.sync)
      subscriptions.set(proxyObject, unsubscribe)
    })
  }

  // If there's a parent watch call, we attach this watch's
  // cleanup to the parent.
  if (currentCleanups) {
    currentCleanups.add(cleanup)
  }

  if (!useTracking) {
    revalidate()
  }

  return {
    track: (track: () => any) => revalidate(track),
    dispose: cleanup,
  }
}

/**
 * watch
 *
 * Creates a reactive effect that automatically tracks proxy objects and
 * reevaluates everytime one of the tracked proxy objects updates. It returns
 * a cleanup function to stop the reactive effect from reevaluating.
 *
 * Callback is invoked immediately to detect the tracked objects.
 *
 * Callback passed to `watch` receives a `get` function that "tracks" the
 * passed proxy object.
 *
 * Watch callbacks may return an optional cleanup function, which is evaluated
 * whenever the callback reevaluates or when the cleanup function returned by
 * `watch` is evaluated.
 *
 * `watch` calls inside `watch` are also automatically tracked and cleaned up
 * whenever the parent `watch` reevaluates.
 *
 * @param callback
 * @returns A cleanup function that stops the callback from reevaluating and
 * also performs cleanups registered into `watch`.
 */
export function watch(
  callback: WatchCallback,
  options?: WatchOptions
): Cleanup {
  const reaction = reactionInternal(callback, false, options)
  return reaction.dispose
}

/**
 * reaction
 *
 * Creates a reactive effect that is invoked when a tracked proxy is updated.
 * It returns a cleanup function to stop the reactive effect from reevaluating,
 * and a track functon which should be invoked with a callback that uses proxies.
 * Any proxy used by the track callback function will be automatically tracked.
 *
 * Unlike `watch` the callback is only invoked when a tracked proxies are changed.
 *
 * Track callbacks may return an optional cleanup function, which is evaluated
 * whenever the callback reevaluates or when the cleanup function returned by
 * `reaction` is evaluated.
 *
 * @param callback
 * @returns A cleanup function that stops the callback from reevaluating and
 * also performs cleanups registered in a track callback.
 */
export function reaction(
  callback: ReactionCallback,
  options?: WatchOptions
): Reaction {
  return reactionInternal(callback, true, options)
}

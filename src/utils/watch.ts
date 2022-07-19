import { subscribe } from '../vanilla'

type Cleanup = () => void
type WatchGet = <T extends object>(proxyObject: T) => T
type WatchCallback = (get: WatchGet) => Cleanup | void | undefined
type WatchOptions = {
  sync?: boolean
}

let currentCleanups: Set<Cleanup> | undefined

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

  const revalidate = () => {
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

    // Ensures that the parent is reset if the callback throws an error.
    try {
      const cleanupReturn = callback((proxyObject) => {
        proxiesToSubscribe.add(proxyObject)
        return proxyObject
      })

      // If there's a cleanup, we add this to the cleanups set
      if (cleanupReturn) {
        cleanups.add(cleanupReturn)
      }
    } finally {
      currentCleanups = parent
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
      const unsubscribe = subscribe(proxyObject, revalidate, options?.sync)
      subscriptions.set(proxyObject, unsubscribe)
    })
  }

  // If there's a parent watch call, we attach this watch's
  // cleanup to the parent.
  if (currentCleanups) {
    currentCleanups.add(cleanup)
  }

  // Invoke effect to create subscription list
  revalidate()

  return cleanup
}

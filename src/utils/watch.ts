import { subscribe } from '../vanilla'

type WatchGet = <T extends object>(value: T) => T
type WatchCallback = (get: WatchGet) => (() => void) | void | undefined

let currentCleanups: Set<() => void> | undefined

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
export const watch = (callback: WatchCallback): (() => void) => {
  const cleanups = new Set<() => void>()
  const subscriptions = new Set<object>()

  let alive = true

  const cleanup = () => {
    // Cleanup subscriptions and other pushed callbacks
    cleanups.forEach((clean) => {
      clean()
    })
    // Clear cleanup set
    cleanups.clear()
    // Clear tracked proxies
    subscriptions.clear()
  }

  const revalidate = () => {
    if (!alive) {
      return
    }
    cleanup()
    // Setup watch context, this allows us to automatically capture
    // watch cleanups if the watch callback itself has watch calls.
    const parent = currentCleanups
    currentCleanups = cleanups

    // Ensures that the parent is reset if the callback throws an error.
    try {
      const cleanupReturn = callback((proxy) => {
        subscriptions.add(proxy)
        return proxy
      })

      // If there's a cleanup, we add this to the cleanups set
      if (cleanupReturn) {
        cleanups.add(cleanupReturn)
      }
    } finally {
      currentCleanups = parent
    }

    // Subscribe to all collected proxies
    subscriptions.forEach((proxy) => {
      const clean = subscribe(proxy, revalidate)
      cleanups.add(clean)
    })
  }

  const wrappedCleanup = () => {
    if (alive) {
      cleanup()
      alive = false
    }
  }

  // If there's a parent watch call, we attach this watch's
  // cleanup to the parent.
  if (currentCleanups) {
    currentCleanups.add(wrappedCleanup)
  }

  // Invoke effect to create subscription list
  revalidate()

  return wrappedCleanup
}

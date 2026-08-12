import { subscribe } from '../../vanilla.ts'

type Cleanup = () => void
type WatchGet = <T extends object>(proxyObject: T) => T
type WatchCallback = (
  get: WatchGet,
) => Cleanup | void | Promise<Cleanup | void> | undefined
type WatchOptions = {
  sync?: boolean
}

let currentCleanups: Set<Cleanup> | undefined

let didWarnDeprecation = false

/**
 * watch
 *
 * @deprecated This util is no longer maintained. Please migrate to [valtio-reactive](https://github.com/valtiojs/valtio-reactive).
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
 */
export function watch(
  callback: WatchCallback,
  options?: WatchOptions,
): Cleanup {
  if (import.meta.env?.MODE !== 'production' && !didWarnDeprecation) {
    console.warn(
      '[DEPRECATED] The `watch` util is no longer maintained. Please migrate to [valtio-reactive](https://github.com/valtiojs/valtio-reactive).',
    )
    didWarnDeprecation = true
  }

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

  const revalidate = async () => {
    if (!alive) {
      return
    }

    // run own cleanups before re-subscribing
    cleanups.forEach((clean) => clean())
    cleanups.clear()

    const proxiesToSubscribe = new Set<ProxyObject>()

    // Setup watch context, this allows us to automatically capture
    // watch cleanups if the watch callback itself has watch calls.
    // Nested watches can only be created during the synchronous part of the
    // callback, so the global context is restored right after the callback
    // returns (before awaiting any returned promise). Keeping it set across
    // the await would leak this watch's cleanups set into unrelated watches
    // created while this one is suspended.
    const parent = currentCleanups
    currentCleanups = cleanups

    let promiseOrPossibleCleanup: ReturnType<WatchCallback>
    try {
      promiseOrPossibleCleanup = callback((proxyObject) => {
        proxiesToSubscribe.add(proxyObject)
        // in case the callback is a promise and the watch has ended
        if (alive && !subscriptions.has(proxyObject)) {
          // subscribe to new proxy immediately -> this fixes problems when Promises are used due to the callstack
          const unsubscribe = subscribe(proxyObject, revalidate, options?.sync)
          subscriptions.set(proxyObject, unsubscribe)
        }
        return proxyObject
      })
    } finally {
      // Restore the parent context before awaiting, so it is not corrupted by
      // (or does not corrupt) revalidations that run while we are suspended.
      currentCleanups = parent
    }

    const couldBeCleanup =
      promiseOrPossibleCleanup && promiseOrPossibleCleanup instanceof Promise
        ? await promiseOrPossibleCleanup
        : promiseOrPossibleCleanup

    // If there's a cleanup, we add this to the cleanups set
    if (couldBeCleanup) {
      if (alive) {
        cleanups.add(couldBeCleanup)
      } else {
        cleanup()
      }
    }

    // Unsubscribe old subscriptions
    subscriptions.forEach((unsubscribe, proxyObject) => {
      if (!proxiesToSubscribe.has(proxyObject)) {
        subscriptions.delete(proxyObject)
        unsubscribe()
      }
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

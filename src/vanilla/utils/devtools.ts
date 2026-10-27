import {
  isProxyObject,
  snapshot,
  subscribe,
  unstable_getInternalStates,
} from '../../vanilla.js'
import type {} from '@redux-devtools/extension'

// FIXME https://github.com/reduxjs/redux-devtools/issues/1097
type Message = {
  type: string
  payload?: any
  state?: any
}

const DEVTOOLS = Symbol()

const { batchAsWrite } = unstable_getInternalStates()

type Config = Parameters<
  (Window extends { __REDUX_DEVTOOLS_EXTENSION__?: infer T }
    ? T
    : { connect: (param: any) => any })['connect']
>[0]

type Options = {
  enabled?: boolean
  name?: string
} & Config

// subscribe() is synchronous, so coalesce a burst of writes into one
// callback to keep sending one devtools message per burst.
const subscribeCoalesced = (
  proxyObject: object,
  callback: () => void,
): (() => void) => {
  let scheduled = false
  let active = true
  const unsubscribe = subscribe(proxyObject, () => {
    if (!scheduled) {
      scheduled = true
      Promise.resolve().then(() => {
        scheduled = false
        if (active) {
          callback()
        }
      })
    }
  })
  return () => {
    active = false
    unsubscribe()
  }
}

type Change = [type: 'set' | 'delete', path: (string | symbol)[]]

// Lists the paths at which two snapshots of a proxy differ, reading the
// proxy alongside the newer one. Unchanged subtrees are the same objects,
// so they are skipped without being visited.
const diffSnapshots = (
  prev: any,
  next: any,
  live: any,
  path: (string | symbol)[],
  changes: Change[],
  seen: WeakSet<object>,
) => {
  if (Object.is(prev, next)) {
    return
  }
  if (
    !isProxyObject(live) ||
    typeof prev !== 'object' ||
    prev === null ||
    Object.getPrototypeOf(prev) !== Object.getPrototypeOf(next)
  ) {
    changes.push(['set', path])
    return
  }
  if (seen.has(next)) {
    return // a cycle
  }
  seen.add(next)
  Reflect.ownKeys(next).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(prev, key)) {
      diffSnapshots(
        prev[key],
        next[key],
        live[key],
        [...path, key],
        changes,
        seen,
      )
    } else {
      changes.push(['set', [...path, key]])
    }
  })
  Reflect.ownKeys(prev).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) {
      changes.push(['delete', [...path, key]])
    }
  })
}

/**
 * Connects a proxy object to Redux DevTools Extension for state debugging
 *
 * This allows real-time monitoring and time-travel debugging of state changes
 * using the Redux DevTools browser extension.
 *
 * Limitation: Only plain objects/values are supported.
 *
 * @example
 * import { devtools } from 'valtio/utils'
 * const state = proxy({ count: 0, text: 'hello' })
 * const unsub = devtools(state, { name: 'state name', enabled: true })
 */
export function devtools<T extends object>(
  proxyObject: T,
  options?: Options,
): (() => void) | undefined {
  const { enabled, name = '', ...rest } = options || {}

  let extension: (typeof window)['__REDUX_DEVTOOLS_EXTENSION__'] | false
  try {
    extension =
      (enabled ?? process.env.NODE_ENV !== 'production') &&
      window.__REDUX_DEVTOOLS_EXTENSION__
  } catch {
    // ignored
  }
  if (!extension) {
    if (process.env.NODE_ENV !== 'production' && enabled) {
      console.warn('[Warning] Please install/enable Redux devtools extension')
    }
    return
  }

  let isTimeTraveling = false
  const devtools = extension.connect({ name, ...rest })
  let prevSnap: unknown = snapshot(proxyObject)
  const unsub1 = subscribeCoalesced(proxyObject, () => {
    const nextSnap = snapshot(proxyObject)
    const changes: Change[] = []
    diffSnapshots(prevSnap, nextSnap, proxyObject, [], changes, new WeakSet())
    prevSnap = nextSnap
    const action = changes
      .filter(([_, path]) => path[0] !== DEVTOOLS)
      .map(([op, path]) => `${op}:${path.map(String).join('.')}`)
      .join(', ')

    if (!action) {
      return
    }

    if (isTimeTraveling) {
      isTimeTraveling = false
    } else {
      const snapWithoutDevtools = Object.assign({}, nextSnap)
      delete (snapWithoutDevtools as any)[DEVTOOLS]
      devtools.send(
        {
          type: action,
          updatedAt: new Date().toLocaleString(),
        } as any,
        snapWithoutDevtools,
      )
    }
  })
  const unsub2 = (
    devtools as unknown as {
      // FIXME https://github.com/reduxjs/redux-devtools/issues/1097
      subscribe: (
        listener: (message: Message) => void,
      ) => (() => void) | undefined
    }
  ).subscribe((message) => {
    if (message.type === 'ACTION' && message.payload) {
      try {
        const state = JSON.parse(message.payload)
        // batchAsWrite reports subscriber errors, so they don't reach the catch.
        batchAsWrite(() => Object.assign(proxyObject, state))
      } catch (e) {
        console.error(
          'please dispatch a serializable value that JSON.parse() and proxy() support\n',
          e,
        )
      }
    }
    if (message.type === 'DISPATCH' && message.state) {
      // Subscribers see the state once it's fully applied.
      batchAsWrite(() => {
        if (
          message.payload?.type === 'JUMP_TO_ACTION' ||
          message.payload?.type === 'JUMP_TO_STATE'
        ) {
          isTimeTraveling = true

          const state = JSON.parse(message.state)
          Object.assign(proxyObject, state)
        }
        ;(proxyObject as any)[DEVTOOLS] = message
      })
    } else if (
      message.type === 'DISPATCH' &&
      message.payload?.type === 'COMMIT'
    ) {
      devtools.init(snapshot(proxyObject))
    } else if (
      message.type === 'DISPATCH' &&
      message.payload?.type === 'IMPORT_STATE'
    ) {
      const actions = message.payload.nextLiftedState?.actionsById
      const computedStates =
        message.payload.nextLiftedState?.computedStates || []

      isTimeTraveling = true

      // Subscribers see only the last state, once.
      batchAsWrite(() => {
        computedStates.forEach(({ state }: { state: any }, index: number) => {
          const action = actions[index] || 'No action found'

          Object.assign(proxyObject, state)

          if (index === 0) {
            devtools.init(snapshot(proxyObject))
          } else {
            devtools.send(action, snapshot(proxyObject))
          }
        })
      })
    }
  })
  devtools.init(snapshot(proxyObject))
  return () => {
    unsub1()
    unsub2?.()
  }
}

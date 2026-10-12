import {
  snapshot,
  subscribe,
  unstable_enableOp,
  unstable_getInternalStates,
} from '../../vanilla.js'
import type { INTERNAL_Op } from '../../vanilla.js'
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
  callback: (unstable_ops: INTERNAL_Op[]) => void,
): (() => void) => {
  const ops: INTERNAL_Op[] = []
  let scheduled = false
  let active = true
  const unsubscribe = subscribe(proxyObject, (newOps) => {
    // Not ops.push(...newOps): a large batch exceeds the argument limit.
    newOps.forEach((op) => ops.push(op))
    if (!scheduled) {
      scheduled = true
      Promise.resolve().then(() => {
        scheduled = false
        if (active) {
          callback(ops.splice(0))
        }
      })
    }
  })
  return () => {
    active = false
    unsubscribe()
  }
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

  unstable_enableOp()
  let isTimeTraveling = false
  const devtools = extension.connect({ name, ...rest })
  const unsub1 = subscribeCoalesced(proxyObject, (unstable_ops) => {
    const action = unstable_ops
      .filter(([_, path]) => path[0] !== DEVTOOLS)
      .map(([op, path]) => `${op}:${path.map(String).join('.')}`)
      .join(', ')

    if (!action) {
      return
    }

    if (isTimeTraveling) {
      isTimeTraveling = false
    } else {
      const snapWithoutDevtools = Object.assign({}, snapshot(proxyObject))
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

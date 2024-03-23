import { snapshot, subscribe } from '../../vanilla.ts'
import type {} from '@redux-devtools/extension'

// FIXME https://github.com/reduxjs/redux-devtools/issues/1097
type Message = {
  type: string
  payload?: any
  state?: any
}

const DEVTOOLS = Symbol()

type Config = Parameters<
  (Window extends { __REDUX_DEVTOOLS_EXTENSION__?: infer T }
    ? T
    : { connect: (param: any) => any })['connect']
>[0]

type Options = {
  enabled?: boolean
  name?: string
} & Config

/**
 * devtools
 *
 * This is to connect with [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools).
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
      (enabled ?? import.meta.env?.MODE !== 'production') &&
      window.__REDUX_DEVTOOLS_EXTENSION__
  } catch {
    // ignored
  }
  if (!extension) {
    if (import.meta.env?.MODE !== 'production' && enabled) {
      console.warn('[Warning] Please install/enable Redux devtools extension')
    }
    return
  }

  let isTimeTraveling = false
  const devtools = extension.connect({ name, ...rest })
  const unsub1 = subscribe(proxyObject, (ops) => {
    const action = ops
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
        Object.assign(proxyObject, JSON.parse(message.payload))
      } catch (e) {
        console.error(
          'please dispatch a serializable value that JSON.parse() and proxy() support\n',
          e,
        )
      }
    }
    if (message.type === 'DISPATCH' && message.state) {
      if (
        message.payload?.type === 'JUMP_TO_ACTION' ||
        message.payload?.type === 'JUMP_TO_STATE'
      ) {
        isTimeTraveling = true

        const state = JSON.parse(message.state)
        Object.assign(proxyObject, state)
      }
      ;(proxyObject as any)[DEVTOOLS] = message
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

      computedStates.forEach(({ state }: { state: any }, index: number) => {
        const action = actions[index] || 'No action found'

        Object.assign(proxyObject, state)

        if (index === 0) {
          devtools.init(snapshot(proxyObject))
        } else {
          devtools.send(action, snapshot(proxyObject))
        }
      })
    }
  })
  devtools.init(snapshot(proxyObject))
  return () => {
    unsub1()
    unsub2?.()
  }
}

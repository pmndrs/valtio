import { snapshot, subscribe } from '../vanilla'

type Message = { type: string; payload?: any; state?: any }

const DEVTOOLS = Symbol()

/**
 * devtools
 *
 * This is to connect with [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension).
 * Limitation: Only plain objects/values are supported.
 *
 * @example
 * import { devtools } from 'valtio/utils'
 * const state = proxy({ count: 0, text: 'hello' })
 * const unsub = devtools(state, 'state name')
 */
export const devtools = <T extends object>(proxyObject: T, name?: string) => {
  let extension: any
  try {
    extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__
  } catch {}
  if (!extension) {
    if (
      typeof process === 'object' &&
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined'
    ) {
      console.warn('[Warning] Please install/enable Redux devtools extension')
    }
    return
  }

  let isTimeTraveling = false
  const devtools = extension.connect({ name })
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
        },
        snapWithoutDevtools
      )
    }
  })
  const unsub2 = devtools.subscribe((message: Message) => {
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
    unsub2()
  }
}

/*
export {
  unstable_createMutableSource as createMutableSource,
  unstable_useMutableSource as useMutableSource,
} from 'react'
*/

// emulation with use-subscription

import { useCallback, useRef, useState } from 'react'
import { useSubscription } from 'use-subscription'

const TARGET = Symbol()
const GET_VERSION = Symbol()

export const createMutableSource = (target: any, getVersion: any) => ({
  [TARGET]: target,
  [GET_VERSION]: getVersion,
})

export const useMutableSource = (
  source: any,
  getSnapshot: any,
  subscribe: any
) => {
  const lastVersion = useRef(0)
  const currentVersion = source[GET_VERSION](source[TARGET])
  const [state, setState] = useState(
    () =>
      [
        currentVersion,
        source,
        getSnapshot,
        () => getSnapshot(source[TARGET]),
      ] as const
  )
  if (
    state[1] !== source ||
    state[2] !== getSnapshot ||
    (currentVersion !== state[0] && currentVersion !== lastVersion.current)
  ) {
    setState([
      currentVersion,
      source,
      getSnapshot,
      () => getSnapshot(source[TARGET]),
    ])
  }
  const sub = useCallback(
    (callback: () => void) =>
      subscribe(source[TARGET], () => {
        lastVersion.current = source[GET_VERSION](source[TARGET])
        callback()
      }),
    [source, subscribe]
  )
  return useSubscription({
    getCurrentValue: state[3],
    subscribe: sub,
  })
}

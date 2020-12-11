/*
export {
  unstable_createMutableSource as createMutableSource,
  unstable_useMutableSource as useMutableSource,
} from 'react'
*/

// emulation with use-subscription

import { useCallback, useRef } from 'react'
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
  const versionDiff = source[GET_VERSION](source[TARGET]) - lastVersion.current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getCurrentValue = useCallback(() => getSnapshot(source[TARGET]), [
    source,
    getSnapshot,
    versionDiff, // XXX this is a hack
  ])
  const sub = useCallback(
    (callback: () => void) =>
      subscribe(source[TARGET], () => {
        lastVersion.current = source[GET_VERSION](source[TARGET])
        callback()
      }),
    [source, subscribe]
  )
  return useSubscription({ getCurrentValue, subscribe: sub })
}

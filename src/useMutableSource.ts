/*
export {
  unstable_createMutableSource as createMutableSource,
  unstable_useMutableSource as useMutableSource,
} from 'react'
*/

// emulation with use-subscription

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [state, setState] = useState(() => ({
    version: currentVersion,
    source,
    getSnapshot,
    getCurrentValue: () => getSnapshot(source[TARGET]),
  }))
  if (
    state.source !== source ||
    state.getSnapshot !== getSnapshot ||
    (currentVersion !== state.version && currentVersion !== lastVersion.current)
  ) {
    setState({
      version: currentVersion,
      source,
      getSnapshot,
      getCurrentValue: () => getSnapshot(source[TARGET]),
    })
  }
  const sub = useCallback(
    (callback: () => void) =>
      subscribe(source[TARGET], () => {
        lastVersion.current = source[GET_VERSION](source[TARGET])
        callback()
      }),
    [source, subscribe]
  )
  useEffect(() => {
    lastVersion.current = source[GET_VERSION](source[TARGET])
  })
  return useSubscription({
    getCurrentValue: state.getCurrentValue,
    subscribe: sub,
  })
}

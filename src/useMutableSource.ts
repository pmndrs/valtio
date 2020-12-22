/*
export {
  unstable_createMutableSource as createMutableSource,
  unstable_useMutableSource as useMutableSource,
} from 'react'
*/

// emulation with use-subscription

import { useEffect, useRef, useState } from 'react'

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
        /* [0] */ source,
        /* [1] */ getSnapshot,
        /* [2] */ subscribe,
        /* [3] */ currentVersion,
        /* [4] */ getSnapshot(source[TARGET]),
      ] as const
  )
  let currentSnapshot = state[4]
  if (
    state[0] !== source ||
    state[1] !== getSnapshot ||
    state[2] !== subscribe ||
    (currentVersion !== state[3] && currentVersion !== lastVersion.current)
  ) {
    currentSnapshot = getSnapshot(source[TARGET])
    setState([source, subscribe, getSnapshot, currentVersion, currentSnapshot])
  }
  useEffect(() => {
    let didUnsubscribe = false
    const checkForUpdates = () => {
      if (didUnsubscribe) {
        return
      }
      const nextVersion = source[GET_VERSION](source[TARGET])
      lastVersion.current = nextVersion
      const nextSnapshot = getSnapshot(source[TARGET])
      setState((prev) => {
        if (
          prev[0] !== source ||
          prev[1] !== getSnapshot ||
          prev[2] !== subscribe
        ) {
          return prev
        }
        if (prev[4] === nextSnapshot) {
          return prev
        }
        return [prev[0], prev[1], prev[2], nextVersion, nextSnapshot]
      })
    }
    const unsubscribe = subscribe(source[TARGET], checkForUpdates)
    checkForUpdates()
    return () => {
      didUnsubscribe = true
      unsubscribe()
    }
  }, [source, getSnapshot, subscribe])
  return currentSnapshot
}

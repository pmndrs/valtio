import React from 'react'
import type { ComponentType } from 'react'
import { useSnapshot } from '../react'

function withProxy<
  Store extends object,
  P extends object,
  S extends object,
  A extends object
>(
  store: Store,
  C: ComponentType<P>,
  mapState?: (s: Store) => S,
  mapActions?: (s: Store) => A
) {
  return function WrappedComponent(props: Omit<P, keyof (S & A)>) {
    const snap = useSnapshot(store)
    const state = mapState?.(snap as Store) ?? {}
    const actions = mapActions?.(store) ?? {}
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // redux-react also ignore this type
    return <C {...props} {...state} {...actions} />
  }
}

/**
 * connect
 *
 * Wrap React class component
 */
export function connect<
  Store extends object,
  S extends object,
  A extends object
>(store: Store, mapState?: (s: Store) => S, mapActions?: (s: Store) => A) {
  return <P extends object>(C: ComponentType<P>) =>
    withProxy(store, C, mapState, mapActions)
}

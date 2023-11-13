import { proxy, ref, snapshot, subscribe } from '../../vanilla.ts'
import type { INTERNAL_Snapshot as Snapshot } from '../../vanilla.ts'
import { deepClone } from './deepClone.ts'

type SnapshotOrUndefined<T> = Snapshot<T> | undefined
type Snapshots<T> = Snapshot<T>[]

/**
 * proxyWithHistory
 *
 * This creates a new proxy with history support.
 * It includes following properties:
 * - value: any value (does not have to be an object)
 * - history: an array holding the history of snapshots
 * - historyIndex: the history index to the current snapshot
 * - canUndo: a function to return true if undo is available
 * - undo: a function to go back history
 * - canRedo: a function to return true if redo is available
 * - redo: a function to go forward history
 * - saveHistory: a function to save history
 *
 * [Notes]
 * Suspense/promise is not supported.
 *
 * @example
 * import { proxyWithHistory } from 'valtio/utils'
 * const state = proxyWithHistory({
 *   count: 1,
 * })
 */
export function proxyWithHistory<V>(initialValue: V, skipSubscribe = false) {
  const proxyObject = proxy({
    value: initialValue,
    history: ref({
      wip: undefined as SnapshotOrUndefined<V>, // to avoid infinite loop
      snapshots: [] as Snapshots<V>,
      index: -1,
    }),
    clone: deepClone,
    canUndo: () => proxyObject.history.index > 0,
    undo: () => {
      if (proxyObject.canUndo()) {
        proxyObject.value = (proxyObject.history.wip = proxyObject.clone(
          proxyObject.history.snapshots[--proxyObject.history.index],
        ) as Snapshot<V>) as V
      }
    },
    canRedo: () =>
      proxyObject.history.index < proxyObject.history.snapshots.length - 1,
    redo: () => {
      if (proxyObject.canRedo()) {
        proxyObject.value = (proxyObject.history.wip = proxyObject.clone(
          proxyObject.history.snapshots[++proxyObject.history.index],
        ) as Snapshot<V>) as V
      }
    },
    saveHistory: () => {
      proxyObject.history.snapshots.splice(proxyObject.history.index + 1)
      proxyObject.history.snapshots.push(snapshot(proxyObject).value)
      ++proxyObject.history.index
    },
    subscribe: () =>
      subscribe(proxyObject, (ops) => {
        if (
          ops.every(
            (op) =>
              op[1][0] === 'value' &&
              (op[0] !== 'set' || op[2] !== proxyObject.history.wip),
          )
        ) {
          proxyObject.saveHistory()
        }
      }),
  })
  proxyObject.saveHistory()
  if (!skipSubscribe) {
    proxyObject.subscribe()
  }
  return proxyObject
}

import { proxy, ref, snapshot, subscribe } from '../vanilla'

/**
 * proxyWithHistory
 *
 * This creates a new proxy with history support.
 * It includes following properties:
 * - value: any value (does not have to be an object)
 * - history: an array holding the history of snapshots
 * - historyIndex: the history index to the current snapshot
 * - canUndo: a function to return true if undo is available
 * - undo: a function to go back hisotry
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
      wip: initialValue, // to avoid infinite loop
      snapshots: [] as V[],
      index: -1,
    }) as { wip: V; snapshots: V[]; index: number },
    canUndo: () => proxyObject.history.index > 0,
    undo: () => {
      if (proxyObject.canUndo()) {
        proxyObject.value = proxyObject.history.wip = proxyObject.history
          .snapshots[--proxyObject.history.index] as V
        // refresh snapshot to use again
        proxyObject.history.snapshots[proxyObject.history.index] = snapshot(
          proxyObject
        ).value as V
      }
    },
    canRedo: () =>
      proxyObject.history.index < proxyObject.history.snapshots.length - 1,
    redo: () => {
      if (proxyObject.canRedo()) {
        proxyObject.value = proxyObject.history.wip = proxyObject.history
          .snapshots[++proxyObject.history.index] as V
        // refresh snapshot to use again
        proxyObject.history.snapshots[proxyObject.history.index] = snapshot(
          proxyObject
        ).value as V
      }
    },
    saveHistory: () => {
      proxyObject.history.snapshots.splice(proxyObject.history.index + 1)
      proxyObject.history.snapshots.push(snapshot(proxyObject).value as V)
      ++proxyObject.history.index
    },
    subscribe: () =>
      subscribe(proxyObject, (ops) => {
        if (
          ops.every(
            (op) =>
              op[1][0] === 'value' &&
              (op[0] !== 'set' || op[2] !== proxyObject.history.wip)
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

import {
  unstable_getInternalStates,
  unstable_replaceInternalFunction,
} from '../../vanilla.js'

const { proxyStateMap } = unstable_getInternalStates()
const initializers = new WeakMap<object, (snapshotObject: object) => void>()

unstable_replaceInternalFunction(
  'createSnapshot',
  (prev) => (target, version) => {
    const snap = prev(target, version)
    let source: object = target
    let initialize = initializers.get(source)
    while (!initialize) {
      const state = proxyStateMap.get(source)
      if (!state) {
        break
      }
      source = state[0]
      initialize = initializers.get(source)
    }
    initialize?.(snap)
    return snap
  },
)

export const registerSnapshotInitializer = (
  target: object,
  initialize: (snapshotObject: object) => void,
): void => {
  initializers.set(target, initialize)
}

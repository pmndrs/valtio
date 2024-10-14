import { snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap-indexMap-keyval.ts'
import { proxySet } from './proxySet.ts'

const state = proxySet(['val1', 'val2'])
const snap1 = snapshot(state)
console.log(snap1.has('val1'), 'true')
state.delete('val2')
const snap2 = snapshot(state)
console.log(snap1.has('val1'), 'true')
console.log(snap1.has('val2'), 'true')
console.log(snap2.has('val1'), 'true')
console.log(snap2.has('val2'), 'false')

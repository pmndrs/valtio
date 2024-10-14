import { snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap-rawMap1.ts'

const state = proxyMap([['key1', 'val1']])
const snap1 = snapshot(state)
console.log(snap1.has('key1'), 'true')
console.log(snap1.get('key1'), 'val1')
state.delete('key1')
const snap2 = snapshot(state)
console.log(snap1.has('key1'), 'true')
console.log(snap1.get('key1'), 'val1')
console.log(snap2.has('key1'), 'false')
console.log(snap2.get('key1'), 'undefined')

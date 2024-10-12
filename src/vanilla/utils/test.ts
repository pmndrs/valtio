import { snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap-indexMap.ts'
const state = proxyMap([['foo', 'bar']])
console.log('test proxy')
const snap = snapshot(state)
console.log('test snapshot')
state.set('bar', 'foo')
console.log('test proxy')
console.log(snap.get('bar'))
console.log('test snapshot')
console.log(snap.get('foo'))
console.log('test snapshot')

console.log(snap)
console.log('test snapshot')

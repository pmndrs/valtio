import { snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap-btree.ts'
const state = proxyMap([['foo', 'bar']])
const snap = snapshot(state)
state.set('bar', 'foo')
console.log(snap.get('bar'))
console.log(snap.get('foo'))

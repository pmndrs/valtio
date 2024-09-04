import { getVersion, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'
import { createProxy, isChanged } from 'proxy-compare';

const affected = new WeakMap()
const s = proxyMap();
const p = createProxy(s, affected)
s.set('k', {})
console.log(isChanged(s, p, affected))
console.log(isChanged(s, p, affected))
const snap1 = snapshot(s)
const v1 = getVersion(s)
console.log(isChanged(s, p, affected))
s.get('k').a = 1;
console.log(isChanged(s, p, affected))
const snap2 = snapshot(s)
const v2 = getVersion(s)
s.set('f', 'foo')

console.log(typeof s.get('k'))
console.log(snap1.get('k'))
console.log(snap1.get('k').a)
console.log(v1)
console.log(v2)

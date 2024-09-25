import { getVersion, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'
import { createProxy, isChanged } from 'proxy-compare'

const p = proxyMap()
p.set('k', { c: 1 })
const s1 = snapshot(p)
const v1 = getVersion(s1)
p.get('k').c++
const s2 = snapshot(p)
const v2 = getVersion(s2)
const v3 = getVersion(p)

console.log(v1)
console.log(v2)
console.log(v3)

import { proxy, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'

const p = proxyMap()
const k = proxy({})
p.set(k, 1)
const snap = snapshot(p)
console.log(snap.get(k), 1)
console.log(snap.get(snapshot(k)), 1)

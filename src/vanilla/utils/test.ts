import { getVersion, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'
import { proxySet } from './proxySet.ts'

const p = proxyMap()
p.set('a', 1)
const s = snapshot(p)
try {
  s.set('a', 2)
} catch {
  console.log('error setting on snapshot')
}
console.log(s.get('a') === 1)
console.log(p.get('a') === 1)
try {
  s.set('b', 3)
} catch {
  console.log('error setting on snapshot')
}
console.log(p.delete('b') === false)

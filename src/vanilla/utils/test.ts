import { getVersion, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'
import { createProxy, isChanged } from 'proxy-compare';

const foo = proxyMap()
foo.set(2, 'asdf')
console.log(foo.get(2))
foo.delete(2)
console.log(foo.get(2))
const obj = { a: 'asdf' }
foo.set(obj, obj)
foo.get(obj).k = 'asdf'
const snap = snapshot(foo)
console.log(snap.get(obj).k)

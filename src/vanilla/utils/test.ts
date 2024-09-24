import { getVersion, snapshot } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.ts'
import { createProxy, isChanged } from 'proxy-compare';

// const p = proxyMap();
// p.set('k', { c: 1 });
// const s1 = snapshot(p);
// p.get('k').c++;
// const s2 = snapshot(p);
// console.log(s1 !== s2)

const p = proxyMap();
const k = {};
p.set(k, 1);
console.log(p.get(k))

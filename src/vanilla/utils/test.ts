import { getVersion, snapshot } from '../../vanilla.ts'
import { proxySet } from './proxySet.ts'

const state = proxySet()
state.add('hello')
state.add('world')
state.add('world')

console.log(state.size)

console.log(getVersion(state))

console.log(snapshot(state))

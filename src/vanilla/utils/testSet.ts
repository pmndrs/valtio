import util from 'util'
import { snapshot } from '../../vanilla.ts'
import { proxySet } from './proxySet.ts'

const initialValues = [
  {
    name: 'array',
    value: ['lorem', false, 1],
  },
  {
    name: 'nested array',
    value: [
      [1, 2, 3],
      [1, 2],
      [51, 2, 3],
    ],
  },
  {
    name: 'Map',
    value: new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]),
  },
  {
    name: 'Set',
    value: new Set([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]),
  },
  {
    name: 'string value',
    value: 'hello',
  },
  {
    name: 'nested Set',
    value: new Set([
      new Set([1, 2, 3]),
      new Set([1, 2]),
      new Set(['x', 'y', 'z']),
    ]),
  },
  {
    name: 'proxySet',
    value: proxySet([1, {}, true]),
  },
  {
    name: 'array of proxySet',
    value: [proxySet([1, 2, 3]), proxySet([1, 2]), proxySet(['x', 'y', 'z'])],
  },
  {
    name: 'list of objects',
    value: [
      { id: Symbol(), field: 'field', bool: true, null: null },
      { id: Symbol(), field: 'field1', bool: false, null: null },
      { id: Symbol(), field: 'field3', bool: true, null: null },
    ],
  },
]

// used to test various input types
const inputValues = [
  {
    name: 'array',
    value: [1, 'hello'],
  },
  {
    name: 'nested array',
    value: [[1, 'hello']],
  },
  {
    name: 'Map',
    value: new Map<any, any>([
      ['key1', 'value1'],
      [{}, 'value2'],
    ]),
  },
  {
    name: 'boolean',
    value: false,
  },
  {
    name: 'number',
    value: 123,
  },
  {
    name: 'string',
    value: 'hello',
  },
  {
    name: 'Set',
    value: new Set([1, 2, 3]),
  },
  {
    name: 'proxySet',
    value: proxySet([1, {}, null, 'xyz', Symbol()]),
  },
  {
    name: 'object',
    value: { id: Symbol(), field: 'field', bool: true, null: null },
  },
]

const dir = (v: any) =>
  console.log(util.inspect(v, { showHidden: true, depth: null, colors: true }))

try {
  initialValues.forEach(({ name, value }) => {
    console.log(name)
    const state = proxySet(value as any)
    const set = new Set(value as any)

    console.log(`${state}` === `${set}`)
    console.log('state.size === set.size')

    console.log(state.size === set.size)
    console.log(Array.from(state.keys()))
    console.log(Array.from(set.keys()))
    console.log(Array.from(state.values()))
    console.log(Array.from(set.values()))
    console.log(Array.from(state.entries()))
    console.log(Array.from(set.entries()))
    console.log(JSON.stringify(state))
    console.log(JSON.stringify(set))
  })
} catch (e) {
  console.log(e)
}

import util from 'util'
import { snapshot, getVersion } from '../../vanilla.ts'
import { proxyMap } from './proxyMap.old.ts'
import { proxySet } from './proxySet.ts'
import { get } from 'http'

const initialValues = [
  {
    name: 'number',
    value: [[-10, 1]],
  },
  {
    name: 'string',
    value: [['hello', 'world']],
  },
  {
    name: 'Symbol',
    value: [[Symbol(), Symbol()]],
  },
  {
    name: 'boolean',
    value: [[false, true]],
  },
  {
    name: 'array',
    value: [
      [
        [10, 'hello'],
        [1, 2, 3, 'x', 'w'],
      ],
    ],
  },
  {
    name: 'object',
    value: [[{}, { id: 'something', field: null }]],
  },
  {
    name: 'null',
    value: [[null, [null, 1]]],
  },
  {
    name: 'function',
    value: [[() => {}, () => {}]],
  },
  {
    name: 'array buffer',
    value: [[new ArrayBuffer(8), new ArrayBuffer(8)]],
  },
  {
    name: 'Set',
    value: [[new Set(), new Set(['x', 'y', 'z'])]],
  },
  {
    name: 'Map',
    value: [[new Map(), new Map([['key', 'value']])]],
  },
  {
    name: 'proxySet',
    value: [[proxySet([{}]), proxySet([{}, Symbol()])]],
  },
]

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

// try {
//   initialValues.forEach(({ name, value }) => {
//     console.log(name)
//     const state = proxyMap(value as any)
//     const map = new Map(value as any)

//     console.log(`${state}` === `${map}`)
//     console.log(state.size)
//     console.log(map.size)
//     console.log(state.size === map.size)
//     console.log(Array.from(state.keys()))
//     console.log(Array.from(map.keys()))
//     console.log(Array.from(state.values()))
//     console.log(Array.from(map.values()))
//     console.log(Array.from(state.entries()))
//     console.log(Array.from(map.entries()))
//     console.log(JSON.stringify(state))
//     console.log(JSON.stringify(map))
//   })
// } catch (e) {
//   console.log(e)
// }

// const s = proxyMap()
// s.set('a', {})
// const v1 = getVersion(s)
// console.log(v1)
// s.get('a').x = 1
// const v2 = getVersion(s)
// console.log(v2)
// console.log(v1 < v2) // must be true

// const state = proxyMap();
// state.set('a', {});
// const snap = snapshot(state);
// snap.get('a').x = 1; // should error or NO-OP
// console.log(snap.get('a'))

// const state = proxyMap();
// console.log(getVersion(state))
// state.set('a', {});
// console.log(getVersion(state))
// console.log(state.get('a'))
// state.delete('a')
// console.log(getVersion(state))
// console.log(state.get('a'))
// console.log(getVersion(state))

// const state = proxyMap()

// state.set('a', 1)
// console.log(state.get('a'))
// console.log(getVersion(state))
// state.set('b', 2)
// console.log(state.get('b'))
// console.log(getVersion(state))
// state.set('c', 3)
// console.log(state.get('c'))
// console.log(getVersion(state))
// console.log(state.get('a'))
// state.forEach((value, key, map) => {
//   if (typeof value === 'number') {
//     map.set(key, value + 1)
//   } else {
//     map.set(key, value)
//   }
// })
// const snap = snapshot(state)
// console.log('snap', snap.get('a'), snap.get('b'))
// console.log(state.get('b'))
// state.delete('a')
// console.log(getVersion(state))
// console.log(state.get('a'))
// console.log(getVersion(state))
// state.clear()
// console.log(getVersion(state))
// state.set('a', ['a'])
// state.get('a').foo = 'bar'
// console.log(state.get('a').foo)
// state.clear().set('a', ['a'])
// console.log(state.get('a').foo)
// const iter = state.entries()
// console.log(iter.next().value)
// console.log(iter.next().value)
// iter.next().value = 'asdf'
// const snap = snapshot(state)
// console.log(snap.get('c'))
// console.log(iter.next())

initialValues.forEach(({ name, value }) => {
  const map = proxyMap(value as any)
  const nativeMap = new Map(value as any)

  if (map.size !== nativeMap.size) {
    console.log(map.size, nativeMap.size)
  }

  if (`${map}` !== `${nativeMap}`) {
    console.log(map, nativeMap)
  }

  // console.log(`${map}` === `${nativeMap}`)
  // console.log(map.size === nativeMap.size)

  const mapValuesArray = Array.from(map.values())
  const nativeMapValuesArray = Array.from(nativeMap.values())

  if (mapValuesArray.length !== nativeMapValuesArray.length) {
    console.log(mapValuesArray.length, nativeMapValuesArray.length)
  }

  // console.log(mapValuesArray.length === nativeMapValuesArray.length)
  mapValuesArray.forEach((v, i) => {
    if (v !== nativeMapValuesArray[i]) {
      console.log(v, nativeMapValuesArray[i])
    }
    // console.log(v === nativeMapValuesArray[i])
  })

  const mapKeysArray = Array.from(map.keys())
  const nativeMapKeysArray = Array.from(nativeMap.keys())

  if (mapKeysArray.length !== nativeMapKeysArray.length) {
    console.log(mapKeysArray.length, nativeMapKeysArray.length)
  }

  // console.log(mapKeysArray.length === nativeMapKeysArray.length)
  mapKeysArray.forEach((v, i) => {
    // console.log(v === nativeMapKeysArray[i])
    if (v !== nativeMapKeysArray[i]) {
      console.log(v, nativeMapKeysArray[i])
    }
  })

  const mapEntriesArray = Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  const nativeMapEntriesArray = Array.from(nativeMap.entries()).sort(
    (a, b) => a[0] - b[0],
  )

  // console.log(mapEntriesArray.length === nativeMapEntriesArray.length)

  if (
    !JSON.stringify(mapEntriesArray) === JSON.stringify(nativeMapEntriesArray)
  ) {
    console.log(mapEntriesArray, nativeMapEntriesArray)
  }

  mapEntriesArray.forEach(([k, v]) => {
    // console.log(k === nativeMapEntriesArray[0][?1])
    if (k !== nativeMapEntriesArray[0][0]) {
      console.log(k, nativeMapEntriesArray[0][0])
    }
  })

  let i = 0
  for (const _ of map) {
    i++
    // console.log(map.size === nativeMap.size)
    // console.log(i === map.size)
    if (map.size !== nativeMap.size) {
      console.log(map.size, nativeMap.size)
    }
  }

  const [firstElementFromMap] = map
  const [firstElementFromNativeMap] = nativeMap

  if (firstElementFromMap !== firstElementFromNativeMap) {
    console.log(firstElementFromMap, firstElementFromNativeMap)
  }

  // console.log('first element from map', firstElementFromMap === firstElementFromNativeMap)
  // console.log(firstElementFromMap?.keys(), firstElementFromNativeMap?.keys())
  // console.log(firstElementFromMap)
  // console.log(firstElementFromNativeMap)

  //   const keyFromMap = firstElementFromMap && firstElementFromMap[0]
  //   const keyFromNativeMap =firstElementFromNativeMap && firstElementFromNativeMap[0]
  //   console.log(keyFromMap === keyFromNativeMap)
  //   console.log(keyFromMap, keyFromNativeMap)
  //   console.log(map.get(keyFromMap))
  //   console.log(nativeMap.get(keyFromNativeMap))

  //   map.delete(keyFromMap)
  //   nativeMap.delete(keyFromNativeMap)
  //   console.log(map.size === nativeMap.size)

  //   map.set('newKey', {})
  //   nativeMap.set('newKey', {})

  //   console.log(map.size === nativeMap.size)

  map.set('newKey', 'newValue')
  nativeMap.set('newKey', 'newValue')
  console.log(map.get('newKey'))
  console.log(nativeMap.get('newKey'))
})

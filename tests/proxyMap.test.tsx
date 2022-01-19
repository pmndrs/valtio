import { proxySet, proxyMap } from 'valtio/utils'

const consoleError = console.error
beforeEach(() => {
  console.error = jest.fn((message) => {
    if (
      process.env.NODE_ENV === 'production' &&
      message.startsWith('act(...) is not supported in production')
    ) {
      return
    }

    consoleError(message)
  })
})
afterEach(() => {
  console.error = consoleError
})

const initialValues = [
  {
    name: 'number',
    value: [-10, 1],
  },
  {
    name: 'string',
    value: ['hello', 'world'],
  },
  {
    name: 'Symbol',
    value: [Symbol(), Symbol()],
  },
  {
    name: 'boolean',
    value: [false, true],
  },
  {
    name: 'array',
    value: [
      [10, 'hello'],
      [1, 2, 3, 'x', 'w'],
    ],
  },
  {
    name: 'object',
    value: [{}, { id: 'somehting', field: null }],
  },
  {
    name: 'null',
    value: [null, [null, 1]],
  },
  {
    name: 'function',
    value: [() => {}, () => {}],
  },
  {
    name: 'array buffer',
    value: [new ArrayBuffer(8), new ArrayBuffer(8)],
  },
  {
    name: 'Set',
    value: [new Set(), new Set(['x', 'y', 'z'])],
  },
  {
    name: 'Map',
    value: [new Map(), new Map([['key', 'value']])],
  },
  {
    name: 'proxySet',
    value: [proxySet([{}]), proxySet([{}, Symbol()])],
  },
]

describe('features parity with native Map', () => {
  initialValues.forEach(({ name, value }) => {
    it(`Support Map operations on ${name}`, () => {
      const map = proxyMap([value as any])
      const nativeMap = new Map([value as any])

      // check for Symbol.toStringTag / toString
      expect(`${map}`).toBe(`${nativeMap}`)

      const expectOutputToMatch = () => {
        expect(map.size).toStrictEqual(nativeMap.size)
        expect(Array.from(map.values())).toStrictEqual(
          Array.from(nativeMap.values())
        )
        expect(Array.from(map.keys())).toStrictEqual(
          Array.from(nativeMap.keys())
        )
        expect(Array.from(map.entries())).toStrictEqual(
          Array.from(nativeMap.entries())
        )
        expect(JSON.stringify(map)).toStrictEqual(JSON.stringify(nativeMap))

        // cover loops
        const handleForEach = jest.fn()
        const handleForOf = jest.fn()

        map.forEach(handleForEach)
        expect(handleForEach).toHaveBeenCalledTimes(map.size)

        for (const _ of map) {
          handleForOf()
        }

        expect(handleForOf).toHaveBeenCalledTimes(map.size)
      }

      expectOutputToMatch()

      const [firstElementFromMap] = map
      const [firstElementFromNativeMap] = nativeMap
      const keyFromMap = firstElementFromMap![0]
      const keyFromNativeMap = firstElementFromNativeMap![0]

      expect(map.has(keyFromMap)).toBe(nativeMap.has(keyFromNativeMap))

      map.delete(keyFromMap)
      nativeMap.delete(keyFromNativeMap)
      expectOutputToMatch()

      map.set('newKey', {})
      nativeMap.set('newKey', {})
      expectOutputToMatch()
    })
  })
})

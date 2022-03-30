import { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'
import { proxyMap, proxySet } from 'valtio/utils'

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
    value: [[{}, { id: 'somehting', field: null }]],
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

describe('features parity with native Map', () => {
  initialValues.forEach(({ name, value }) => {
    it(`Support Map operations on ${name}`, () => {
      const map = proxyMap(value as any)
      const nativeMap = new Map(value as any)

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

      // Bypass Forbidden non-null assertion
      const keyFromMap = firstElementFromMap && firstElementFromMap[0]
      const keyFromNativeMap =
        firstElementFromNativeMap && firstElementFromNativeMap[0]

      expect(map.has(keyFromMap)).toBe(nativeMap.has(keyFromNativeMap))

      map.delete(keyFromMap)
      nativeMap.delete(keyFromNativeMap)
      expectOutputToMatch()

      map.set('newKey', {})
      nativeMap.set('newKey', {})
      expectOutputToMatch()

      // test value replacement
      map.set('newKey', 'newValue')
      nativeMap.set('newKey', 'newValue')
      expectOutputToMatch()

      // test getter
      expect(map.get('newKey')).toBe(nativeMap.get('newKey'))
    })
  })

  it('support initialization with null', () => {
    const map = proxyMap(null)
    const nativeMap = new Map(null)

    expect(map.size).toStrictEqual(nativeMap.size)
    expect(Array.from(map.values())).toStrictEqual(
      Array.from(nativeMap.values())
    )
    expect(Array.from(map.keys())).toStrictEqual(Array.from(nativeMap.keys()))
    expect(Array.from(map.entries())).toStrictEqual(
      Array.from(nativeMap.entries())
    )
  })
})

describe('clear map', () => {
  initialValues.forEach(({ name, value }) => {
    it(`clear proxyMap of ${name}`, async () => {
      const state = proxyMap(value as any)

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.size}</div>
            <button onClick={() => state.clear()}>button</button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>
      )

      expect(state.size).toBeGreaterThan(0)
      getByText(`size: ${state.size}`)

      fireEvent.click(getByText('button'))
      await waitFor(() => {
        getByText('size: 0')
      })
    })
  })
})

describe('add value', () => {
  inputValues.forEach(({ name, value }) => {
    it(`update size when adding ${name}`, async () => {
      const state = proxy({
        map: proxyMap(),
      })

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.map.size}</div>
            <button onClick={() => state.map.set(value, value)}>button</button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>
      )

      getByText('size: 0')
      fireEvent.click(getByText('button'))

      await waitFor(() => {
        getByText('size: 1')
      })
    })
  })
})

describe('delete', () => {
  inputValues.forEach(({ name, value }) => {
    it(`return false when trying to delete non-existing value of type ${name}`, () => {
      const set = proxyMap()

      expect(set.delete(value)).toBe(false)
    })
  })

  initialValues.forEach(({ name, value }) => {
    it(`support delete on key of type ${name}`, async () => {
      const state = proxy({
        map: proxyMap(value as any),
      })

      // pick a random value from the set
      const [firstValue] = state.map

      // Bypass Forbidden non-null assertion
      const firstKey = firstValue && firstValue[0]

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.map.size}</div>
            <button onClick={() => state.map.delete(firstKey)}>button</button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>
      )

      getByText(`size: ${state.map.size}`)

      const expectedSizeAfterDelete =
        state.map.size > 1 ? state.map.size - 1 : 0

      fireEvent.click(getByText('button'))
      await waitFor(() => {
        getByText(`size: ${expectedSizeAfterDelete}`)
      })
    })
  })
})

describe('proxyMap internal', () => {
  it('should be sealed', () => {
    expect(Object.isSealed(proxySet())).toBe(true)
  })

  it('should list only enumerable properties', () => {
    const notEnumerableProps = ['data', 'size', 'toJSON']
    expect(
      Object.keys(proxyMap()).some((k) => notEnumerableProps.includes(k))
    ).toBe(false)
  })
})

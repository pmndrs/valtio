import { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { proxySet } from 'valtio/utils'

// used to initialize proxySet during tests
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

describe('features parity with native Set', () => {
  initialValues.forEach(({ name, value }) => {
    it(`support Set operations on ${name}`, () => {
      const set = proxySet<unknown>(value)
      const nativeSet = new Set<unknown>(value)

      // check for Symbol.toStringTag / toString
      expect(`${set}`).toBe(`${nativeSet}`)

      const expectOutputToMatch = () => {
        expect(set.size).toStrictEqual(nativeSet.size)
        expect(Array.from(set.values())).toStrictEqual(
          Array.from(nativeSet.values()),
        )
        expect(Array.from(set.keys())).toStrictEqual(
          Array.from(nativeSet.keys()),
        )
        expect(Array.from(set.entries())).toStrictEqual(
          Array.from(nativeSet.entries()),
        )
        expect(JSON.stringify(set)).toStrictEqual(JSON.stringify(nativeSet))

        JSON.stringify(set, (_, setV) => {
          JSON.stringify(nativeSet, (_, nativeSetV) => {
            expect(setV).toStrictEqual(nativeSetV)
          })
        })

        // cover loops
        const handleForEach = vi.fn()
        const handleForOf = vi.fn()

        set.forEach(handleForEach)
        expect(handleForEach).toHaveBeenCalledTimes(set.size)

        for (const _ of set) {
          handleForOf()
        }

        expect(handleForOf).toHaveBeenCalledTimes(set.size)
      }

      expectOutputToMatch()

      const [valueToDeleteFromSet] = set
      const [valueToDeleteFromNativeSet] = nativeSet

      expect(set.delete(valueToDeleteFromSet)).toBe(
        nativeSet.delete(valueToDeleteFromNativeSet),
      )

      expectOutputToMatch()

      set.add('newValue')
      nativeSet.add('newValue')
      expectOutputToMatch()

      set.clear()
      nativeSet.clear()
      expectOutputToMatch()
    })
  })

  inputValues.forEach(({ value, name }) => {
    it(`prevent adding duplicate for type ${name}`, () => {
      const set = proxySet<unknown>([value])

      expect(set.size).toBe(1)

      set.add(value)
      expect(set.size).toBe(1)
    })
  })
})

describe('unsupported initial values', () => {
  const unsupportedInputTestCases = [
    {
      name: 'boolean',
      value: true,
    },
    {
      name: 'number',
      value: 123,
    },
    {
      name: 'symbol',
      value: Symbol(),
    },
  ]

  unsupportedInputTestCases.forEach(({ name, value }) => {
    it(`throw type error when using ${name} as initial value`, () => {
      expect(() => proxySet(value as any)).toThrow(/not iterable/)
    })
  })
})

describe('clear set', () => {
  initialValues.forEach(({ name, value }) => {
    it(`clear proxySet of ${name}`, async () => {
      const state = proxy({
        set: proxySet<unknown>(value),
      })

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.set.size}</div>
            <button onClick={() => state.set.clear()}>button</button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      getByText(`size: ${state.set.size}`)

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
        set: proxySet(),
      })

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.set.size}</div>
            <button onClick={() => state.set.add(value)}>button</button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
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
  initialValues.forEach(({ name, value }) => {
    it(`support delete on ${name}`, async () => {
      const state = proxy({
        set: proxySet<unknown>(value),
      })

      // pick a random value from the set
      const valueToDelete = Array.from(state.set)[
        Math.floor(Math.random() * state.set.size)
      ]

      const TestComponent = () => {
        const snap = useSnapshot(state)

        return (
          <>
            <div>size: {snap.set.size}</div>
            <button onClick={() => state.set.delete(valueToDelete)}>
              button
            </button>
          </>
        )
      }

      const { getByText } = render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      getByText(`size: ${state.set.size}`)

      const expectedSizeAfterDelete =
        state.set.size > 1 ? state.set.size - 1 : 0

      fireEvent.click(getByText('button'))
      await waitFor(() => {
        getByText(`size: ${expectedSizeAfterDelete}`)
      })
    })
  })

  inputValues.forEach(({ name, value }) => {
    it(`return false when trying to delete non-existing value of type ${name}`, () => {
      const set = proxySet()

      expect(set.delete(value)).toBe(false)
    })
  })
})

describe('proxySet internal', () => {
  it('should be sealed', () => {
    expect(Object.isSealed(proxySet())).toBe(true)
  })

  it('should list only enumerable properties', () => {
    const notEnumerableProps = ['data', 'size', 'toJSON']
    expect(
      Object.keys(proxySet()).some((k) => notEnumerableProps.includes(k)),
    ).toBe(false)
  })
})

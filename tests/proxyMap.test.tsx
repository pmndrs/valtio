import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, useSnapshot } from 'valtio'
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
          Array.from(nativeMap.values()),
        )
        expect(Array.from(map.keys())).toStrictEqual(
          Array.from(nativeMap.keys()),
        )
        expect(Array.from(map.entries())).toStrictEqual(
          Array.from(nativeMap.entries()),
        )
        expect(JSON.stringify(map)).toStrictEqual(JSON.stringify(nativeMap))

        JSON.stringify(map, (_, mapV) => {
          JSON.stringify(nativeMap, (_, nativeMapV) => {
            expect(mapV).toStrictEqual(nativeMapV)
          })
        })

        // cover loops
        const handleForEach = vi.fn()
        const handleForOf = vi.fn()

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
      Array.from(nativeMap.values()),
    )
    expect(Array.from(map.keys())).toStrictEqual(Array.from(nativeMap.keys()))
    expect(Array.from(map.entries())).toStrictEqual(
      Array.from(nativeMap.entries()),
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

      render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      expect(state.size).toBeGreaterThan(0)
      screen.getByText(`size: ${state.size}`)

      fireEvent.click(screen.getByText('button'))
      await waitFor(() => {
        screen.getByText('size: 0')
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

      render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      screen.getByText('size: 0')
      fireEvent.click(screen.getByText('button'))

      await waitFor(() => {
        screen.getByText('size: 1')
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

      render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      screen.getByText(`size: ${state.map.size}`)

      const expectedSizeAfterDelete =
        state.map.size > 1 ? state.map.size - 1 : 0

      fireEvent.click(screen.getByText('button'))
      await waitFor(() => {
        screen.getByText(`size: ${expectedSizeAfterDelete}`)
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
      Object.keys(proxyMap()).some((k) => notEnumerableProps.includes(k)),
    ).toBe(false)
  })
})

describe('snapshot', () => {
  it('should error when trying to mutate a snapshot', () => {
    const state = proxyMap()
    const snap = snapshot(state)

    // @ts-expect-error - snapshot should not be able to mutate
    expect(() => snap.set('foo', 'bar')).toThrow(
      'Cannot perform mutations on a snapshot',
    )
    // @ts-expect-error - snapshot should not be able to mutate
    expect(() => snap.delete('foo')).toThrow(
      'Cannot perform mutations on a snapshot',
    )
    // @ts-expect-error - snapshot should not be able to mutate
    expect(() => snap.clear()).toThrow('Cannot perform mutations on a snapshot')
  })

  it('should not change snapshot with modifying the original proxy', async () => {
    const state = proxyMap([
      ['key1', {}],
      ['key2', { nested: { count: 1 } }],
    ])
    const snap1 = snapshot(state)
    expect(snap1.get('key1')).toBeDefined()
    state.get('key2')!.nested!.count++
    const snap2 = snapshot(state)
    expect(snap1.get('key2')!.nested!.count).toBe(1)
    expect(snap2.get('key2')!.nested!.count).toBe(2)
  })

  it('should work with deleting a key', async () => {
    const state = proxyMap([['key1', 'val1']])
    const snap1 = snapshot(state)
    expect(snap1.has('key1')).toBe(true)
    expect(snap1.get('key1')).toBe('val1')
    state.delete('key1')
    const snap2 = snapshot(state)
    expect(snap1.has('key1')).toBe(true)
    expect(snap1.get('key1')).toBe('val1')
    expect(snap2.has('key1')).toBe(false)
    expect(snap2.get('key1')).toBe(undefined)
  })

  it('should work with deleting a key and adding it again', async () => {
    const state = proxyMap()
    state.set('key1', 'val1')
    const snap1 = snapshot(state)
    expect(snap1.get('key1')).toBe('val1')
    state.delete('key1')
    state.set('key2', 'val2')
    state.set('key1', 'val1modified')
    const snap2 = snapshot(state)
    expect(snap1.get('key1')).toBe('val1')
    expect(snap2.get('key1')).toBe('val1modified')
  })
})

describe('ui updates - useSnapshot', async () => {
  it('should update ui when calling has before and after setting and deleting a key', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key: {`${snap.has('key')}`}</p>
          <button onClick={() => state.set('key', 'value')}>set key</button>
          <button onClick={() => state.delete('key')}>delete key</button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    await waitFor(() => {
      screen.getByText('has key: false')
    })

    fireEvent.click(screen.getByText('set key'))
    await waitFor(() => {
      screen.getByText('has key: true')
    })

    fireEvent.click(screen.getByText('delete key'))
    await waitFor(() => {
      screen.getByText('has key: false')
    })
  })

  it('should update ui when calling has before and after settiing and deleting multiple keys', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key: {`${snap.has('key')}`}</p>
          <p>has key2: {`${snap.has('key2')}`}</p>
          <button
            onClick={() => {
              state.set('key', 'value')
              state.set('key2', 'value')
            }}
          >
            set keys
          </button>
          <button
            onClick={() => {
              state.delete('key')
              state.delete('key2')
            }}
          >
            delete keys
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: true')
    })

    fireEvent.click(screen.getByText('delete keys'))
    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })
  })

  it('should update ui when calling has before and after settiing multile keys and deleting a single one (first item)', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key: {`${snap.has('key')}`}</p>
          <p>has key2: {`${snap.has('key2')}`}</p>
          <button
            onClick={() => {
              state.set('key', 'value')
              state.set('key2', 'value')
            }}
          >
            set keys
          </button>
          <button
            onClick={() => {
              state.delete('key')
            }}
          >
            delete keys
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: true')
    })

    fireEvent.click(screen.getByText('delete keys'))
    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: true')
    })
  })

  it('should update ui when calling has before and after settiing multile keys and deleting a single one (first item)', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key: {`${snap.has('key')}`}</p>
          <p>has key2: {`${snap.has('key2')}`}</p>
          <button
            onClick={() => {
              state.set('key', 'value')
              state.set('key2', 'value')
            }}
          >
            set keys
          </button>
          <button
            onClick={() => {
              state.delete('key2')
            }}
          >
            delete keys
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: true')
    })

    fireEvent.click(screen.getByText('delete keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: false')
    })
  })

  it('should update ui when clearing the map', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key: {`${snap.has('key')}`}</p>
          <p>has key2: {`${snap.has('key2')}`}</p>
          <button
            onClick={() => {
              state.set('key', 'value')
              state.set('key2', 'value')
            }}
          >
            set keys
          </button>
          <button
            onClick={() => {
              state.clear()
            }}
          >
            clear map
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: true')
    })

    fireEvent.click(screen.getByText('clear map'))
    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
    })
  })
})

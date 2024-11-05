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

  it('should update ui when calling get with absent key that has been added later', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>value: {`${snap.get('key')}`}</p>
          <button
            onClick={() => {
              state.set('key', 'value')
            }}
          >
            set key
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
      </StrictMode>,
    )

    screen.getByText('value: undefined')

    fireEvent.click(screen.getByText('set key'))
    await waitFor(() => {
      screen.getByText('value: value')
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

  it('should update ui when calling has/get before and after settiing multile keys and deleting a single one multiple times', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>has key1: {`${snap.has('key')}`}</p>
          <p>value1: {`${snap.get('key')}`}</p>
          <p>has key2: {`${snap.has('key2')}`}</p>
          <p>value2: {`${snap.get('key2')}`}</p>

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
            delete key 1
          </button>
          <button
            onClick={() => {
              state.delete('key2')
            }}
          >
            delete key 2
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
      screen.getByText('has key1: false')
      screen.getByText('value1: undefined')
      screen.getByText('has key2: false')
      screen.getByText('value2: undefined')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key1: true')
      screen.getByText('has key2: true')
      screen.getByText('value1: value')
      screen.getByText('value2: value')
    })

    fireEvent.click(screen.getByText('delete key 1'))
    await waitFor(() => {
      screen.getByText('has key1: false')
      screen.getByText('value1: undefined')
      screen.getByText('has key2: true')
      screen.getByText('value2: value')
    })

    fireEvent.click(screen.getByText('delete key 2'))
    await waitFor(() => {
      screen.getByText('has key1: false')
      screen.getByText('value1: undefined')
      screen.getByText('has key2: false')
      screen.getByText('value2: undefined')
    })
  })

  it('should update ui when calling only one get with absent key added later', async () => {
    const state = proxyMap()
    const TestComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <button
            onClick={() => {
              state.set('key', 'value')
            }}
          >
            set key
          </button>
          <button
            onClick={() => {
              state.delete('key')
            }}
          >
            delete key
          </button>
        </>
      )
    }

    const SeparateComponent = () => {
      const snap = useSnapshot(state)

      return (
        <>
          <p>value: {`${snap.get('key')}`}</p>
        </>
      )
    }

    render(
      <StrictMode>
        <TestComponent />
        <SeparateComponent />
      </StrictMode>,
    )

    screen.getByText('value: undefined')

    fireEvent.click(screen.getByText('set key'))
    await waitFor(() => {
      screen.getByText('value: value')
    })

    fireEvent.click(screen.getByText('delete key'))
    await waitFor(() => {
      screen.getByText('value: undefined')
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
          <p>value1: {`${snap.get('key')}`}</p>
          <p>value2: {`${snap.get('key2')}`}</p>
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
      screen.getByText('value1: undefined')
      screen.getByText('value2: undefined')
    })

    fireEvent.click(screen.getByText('set keys'))
    await waitFor(() => {
      screen.getByText('has key: true')
      screen.getByText('has key2: true')
      screen.getByText('value1: value')
      screen.getByText('value2: value')
    })

    fireEvent.click(screen.getByText('clear map'))
    await waitFor(() => {
      screen.getByText('has key: false')
      screen.getByText('has key2: false')
      screen.getByText('value1: undefined')
      screen.getByText('value2: undefined')
    })
  })
})

describe('ui updates - useSnapshot - iterator methods', () => {
  const iteratorMethods = ['keys', 'values', 'entries'] as const

  iteratorMethods.forEach((iteratorMethod) => {
    it(`should be reactive to changes when using ${iteratorMethod} method`, async () => {
      interface MapItem {
        id: number
        name: string
      }
      const state = proxyMap<number, MapItem>()
      const TestComponent = () => {
        const snap = useSnapshot(state)

        const addItem = (id: number) => {
          const item: MapItem = {
            id,
            name: `item ${id}`,
          }
          state.set(item.id, item)
        }

        const methods = {
          entries: Array.from(snap.entries()).map(([id, item]) => (
            <li key={id}>{`item.name: ${item.name}; item.id: ${item.id}`}</li>
          )),
          values: Array.from(snap.values()).map((item) => (
            <li
              key={item.id}
            >{`item.name: ${item.name}; item.id: ${item.id}`}</li>
          )),
          keys: Array.from(snap.keys()).map((id) => {
            const item = snap.get(id)!
            return (
              <li key={id}>{`item.name: ${item.name}; item.id: ${item.id}`}</li>
            )
          }),
        }

        return (
          <>
            <button
              onClick={() => {
                state.set(1, { name: 'item 1 updated', id: 1 })
              }}
            >
              Update
            </button>
            <button onClick={() => addItem(1)}>Add</button>
            <ul>{methods[iteratorMethod]}</ul>
          </>
        )
      }

      render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      fireEvent.click(screen.getByText('Add'))
      await waitFor(() => {
        screen.getByText(`item.name: item 1; item.id: 1`)
      })

      fireEvent.click(screen.getByText('Update'))
      await waitFor(() => {
        screen.getByText(`item.name: item 1 updated; item.id: 1`)
      })
    })

    it(`should be reactive to changes when using ${iteratorMethod} method when setting multiple values`, async () => {
      interface MapItem {
        id: number
        name: string
      }
      const state = proxyMap<number, MapItem>()

      const TestComponent = () => {
        const snap = useSnapshot(state)

        const addItem = (id: number) => {
          const item: MapItem = {
            id,
            name: `item ${id}`,
          }
          state.set(item.id, item)
        }

        return (
          <>
            <button
              onClick={() => {
                state.forEach((value, key) => {
                  state.set(key, { ...value, name: `${value.name} updated` })
                })
              }}
            >
              Update
            </button>
            <button
              onClick={() => {
                state.delete(1)
              }}
            >
              Delete
            </button>
            <button
              onClick={() => {
                addItem(1)
                addItem(2)
              }}
            >
              Add
            </button>
            <ul>
              {iteratorMethod === 'entries'
                ? Array.from(snap[iteratorMethod]()).map(([id, item]) => (
                    <li
                      key={id}
                    >{`item.name: ${item.name}; item.id: ${item.id}`}</li>
                  ))
                : iteratorMethod === 'values'
                  ? Array.from(snap[iteratorMethod]()).map((item) => (
                      <li
                        key={item.id}
                      >{`item.name: ${item.name}; item.id: ${item.id}`}</li>
                    ))
                  : Array.from(snap[iteratorMethod]()).map((id) => {
                      const item = snap.get(id)!
                      return (
                        <li
                          key={id}
                        >{`item.name: ${item.name}; item.id: ${item.id}`}</li>
                      )
                    })}
            </ul>
          </>
        )
      }

      render(
        <StrictMode>
          <TestComponent />
        </StrictMode>,
      )

      fireEvent.click(screen.getByText('Add'))
      await waitFor(() => {
        screen.getByText(`item.name: item 1; item.id: 1`)
        screen.getByText(`item.name: item 2; item.id: 2`)
      })

      fireEvent.click(screen.getByText('Update'))
      await waitFor(() => {
        screen.getByText(`item.name: item 1 updated; item.id: 1`)
        screen.getByText(`item.name: item 2 updated; item.id: 2`)
      })
    })
  })
})

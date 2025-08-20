import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import 'timers'

describe('optimization', () => {
  beforeEach(() => {
    // don't fake setImmediate, it conflict with javascript debugger and cause stuck
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'Date',
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should rerender if the leaf value does not change but the object reference does', async () => {
    const state = proxy({ nested: { count: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Count: {snap.nested.count}</div>
          <button
            onClick={() => {
              state.nested = { count: 0 }
            }}
          >
            button-zero
          </button>
          <button
            onClick={() => {
              state.nested = { count: 1 }
            }}
          >
            button-one
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('button-zero'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('button-one'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(3)
  })

  it('regression: useSnapshot renders should not fail consistency check with extra render (nested useSnapshot)', async () => {
    const obj = proxy({ childCount: 0, parentCount: 0 })

    const childRenderFn = vi.fn()
    const Child = () => {
      const snap = useSnapshot(obj)
      childRenderFn(snap.childCount)
      return (
        <>
          <div>childCount: {snap.childCount}</div>
          <button onClick={() => ++obj.childCount}>childButton</button>
        </>
      )
    }

    const parentRenderFn = vi.fn()
    const Parent = () => {
      const snap = useSnapshot(obj)
      parentRenderFn(snap.parentCount)
      return (
        <>
          <div>parentCount: {snap.parentCount}</div>
          <button onClick={() => ++obj.parentCount}>parentButton</button>
          <Child />
        </>
      )
    }

    render(<Parent />)

    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 0')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(1)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(1)
    expect(parentRenderFn).lastCalledWith(0)

    obj.parentCount += 1

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 1')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(2)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(2)
    expect(parentRenderFn).lastCalledWith(1)
  })

  it('regression: useSnapshot renders should not fail consistency check with extra render', async () => {
    const obj = proxy({ childCount: 0, anotherValue: 0 })

    const childRenderFn = vi.fn()
    const Child = () => {
      const snap = useSnapshot(obj)
      childRenderFn(snap.childCount)
      return (
        <>
          <div>childCount: {snap.childCount}</div>
          <button onClick={() => ++obj.childCount}>childButton</button>
        </>
      )
    }

    const parentRenderFn = vi.fn()
    const Parent = () => {
      const [parentCount, setParentCount] = useState(0)

      parentRenderFn(parentCount)

      return (
        <>
          <div>parentCount: {parentCount}</div>
          <button onClick={() => setParentCount((v) => v + 1)}>
            parentButton
          </button>
          <Child />
        </>
      )
    }

    render(<Parent />)

    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 0')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(1)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(1)
    expect(parentRenderFn).lastCalledWith(0)

    obj.anotherValue += 1

    fireEvent.click(screen.getByText('parentButton'))
    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 1')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(2)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(2)
    expect(parentRenderFn).lastCalledWith(1)
  })

  it('subscribe different property on seperate renders', async () => {
    const state = proxy({ switch: false, a: 0, b: 1 })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>
            Count: {snap.switch ? 'b' : 'a'}:{snap.switch ? snap.b : snap.a}
          </div>
          <button
            onClick={() => {
              state.switch = true
            }}
          >
            switch
          </button>
          <button
            onClick={() => {
              state.a++
            }}
          >
            increment a
          </button>
          <button
            onClick={() => {
              state.b++
            }}
          >
            increment b
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Count: a:0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)
    expect(screen.getByText('Count: a:1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('increment b'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('switch'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(3)
    expect(screen.getByText('Count: b:2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(3)

    fireEvent.click(screen.getByText('increment b'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(4)
    expect(screen.getByText('Count: b:3')).toBeInTheDocument()
  })

  it('no rerender if nested property is updated but not accessed', async () => {
    const state = proxy({ nested: { a: 0, b: 1 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Count: {snap.nested.a}</div>
          <button
            onClick={() => {
              state.nested.a++
            }}
          >
            increment a
          </button>
          <button
            onClick={() => {
              state.nested.b++
            }}
          >
            increment b
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('increment b'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('rerender if nested object no access but updated', async () => {
    const state = proxy({ nested: { a: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Nested: {snap.nested !== undefined ? 'Exist' : 'Not Exist'}</div>
          <button
            onClick={() => {
              state.nested.a++
            }}
          >
            increment a
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Nested: Exist')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)
  })

  it('no rerender if nested object no properties access but property updated with option initEntireSubscribe: false', async () => {
    const state = proxy({ nested: { a: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state, { initEntireSubscribe: false })
      renderFn()
      return (
        <>
          <div>Nested: {snap.nested !== undefined ? 'Exist' : 'Not Exist'}</div>
          <button
            onClick={() => {
              state.nested.a++
            }}
          >
            increment a
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Nested: Exist')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(1)
  })

  it('rerender if deep nested object no properties access but reference updated with option initEntireSubscribe: false', async () => {
    const state = proxy({
      a: {
        b1: {
          c: 0,
        },
        b2: {
          c: 0,
        },
      },
    })

    const renderFn = vi.fn()
    const Component = ({ name }: { name: string }) => {
      const snap = useSnapshot(state, { initEntireSubscribe: false })
      renderFn()
      return (
        <>
          <div>
            {name}{' '}
            {name === 'A' ? snap.a.b1 && snap.a.b2 && 'b1b2' : snap.a.b1.c}
          </div>
          <button
            onClick={() => {
              state.a.b1 = { c: state.a.b1.c + 1 }
            }}
          >
            {name} increment c
          </button>
        </>
      )
    }

    render(
      <>
        <Component name="A" />
        <Component name="B" />
      </>,
    )

    expect(screen.getByText('A b1b2')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('A increment c'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(4)
  })

  it('rerender if nested object no access and deleted with option initEntireSubscribe: false', async () => {
    const state = proxy({ nested: { a: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state, { initEntireSubscribe: false })
      renderFn()
      return (
        <>
          <div>Nested: {snap.nested !== undefined ? 'Exist' : 'Not Exist'}</div>
          <button
            onClick={() => {
              delete (state as any).nested
            }}
          >
            delete nested
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Nested: Exist')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('delete nested'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('Nested: Not Exist')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
  })

  it('re-subscribe after nested object re-assigned', async () => {
    const state = proxy({ nested: { a: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Nested a: {snap.nested.a}</div>
          <button
            onClick={() => {
              state.nested = { a: 0, b: 0 } as any
            }}
          >
            re-assign nested
          </button>
          <button
            onClick={() => {
              state.nested.a++
            }}
          >
            increment a
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Nested a: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('re-assign nested'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('Nested a: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(3)
  })

  it('rerender and re-subscribe after nested object re-assigned initEntireSubscribe: false', async () => {
    const state = proxy({ nested: { a: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state, { initEntireSubscribe: false })
      renderFn()
      return (
        <>
          <div>Nested a: {snap.nested.a}</div>
          <button
            onClick={() => {
              state.nested = { a: 0, b: 0 } as any
            }}
          >
            re-assign nested
          </button>
          <button
            onClick={() => {
              state.nested.a++
            }}
          >
            increment a
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Nested a: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('re-assign nested'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('increment a'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toBeCalledTimes(3)
    expect(screen.getByText('Nested a: 1')).toBeInTheDocument()
  })
})

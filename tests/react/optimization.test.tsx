import { Suspense, startTransition, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { useCommitCount } from '../test-utils.js'

describe('optimization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not rerender if the leaf value does not change', async () => {
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
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('button-one'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
  })

  it('should not track snapshots assigned outside render', async () => {
    const source = proxy({ nested: { count: 0, other: 0 } })
    const destination = proxy<{ value?: object }>({})
    let nested!: object
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(source)
      nested = snap.nested
      renderFn(snap.nested.count)
      return null
    }

    render(<Component />)
    destination.value = nested
    snapshot(destination)
    source.nested.other = 1
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should unwrap nested snapshots assigned outside render', async () => {
    const source = proxy({ nested: { count: 0, other: 0 } })
    const destination = proxy<{ value: { nested?: object } }>({ value: {} })
    let nested!: object
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(source)
      nested = snap.nested
      renderFn(snap.nested.count)
      return null
    }

    render(<Component />)
    destination.value = { nested }
    snapshot(destination)
    source.nested.other = 1
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should not rerender for deleting a non-own property', async () => {
    const base = Object.create({ inherited: 1 }) as {
      missing?: number
      inherited?: number
    }
    const state = proxy(base)
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <div>
          Values: {String(snap.missing)}, {snap.inherited}
        </div>
      )
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.missing
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.inherited
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should update subscriptions when accessed keys change', async () => {
    const state = proxy({ useA: true, a: 0, b: 0 })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Count: {snap.useA ? snap.a : snap.b}</div>
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.useA = false
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should retain keys accessed before a prop change', async () => {
    const state = proxy({ a: 0, b: 0 })
    const renderFn = vi.fn()
    const Component = ({ useA }: { useA: boolean }) => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Count: {useA ? snap.a : snap.b}</div>
    }

    const { rerender } = render(<Component useA />)
    rerender(<Component useA={false} />)
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(4)
  })

  it('should detect a new-key mutation before passive subscription', async () => {
    const state = proxy({ a: 0, b: 0 })
    const Component = ({ useA }: { useA: boolean }) => {
      const snap = useSnapshot(state)
      useLayoutEffect(() => {
        if (!useA) {
          state.b += 1
        }
      }, [useA])
      return <div>Count: {useA ? snap.a : snap.b}</div>
    }

    const { rerender } = render(<Component useA />)
    rerender(<Component useA={false} />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('should update subscriptions when the root proxy changes', async () => {
    const first = proxy({ count: 0 })
    const second = proxy({ count: 0 })
    const renderFn = vi.fn()
    const Component = ({ state }: { state: { count: number } }) => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Count: {snap.count}</div>
    }

    const { rerender } = render(<Component state={first} />)
    rerender(<Component state={second} />)
    expect(renderFn).toHaveBeenCalledTimes(2)

    first.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    second.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should keep committed subscriptions during a suspended render', async () => {
    const state = proxy({ a: 0, b: 0 })
    const promise = new Promise<void>(() => {})
    const Component = ({ useA }: { useA: boolean }) => {
      const snap = useSnapshot(state)
      if (!useA) {
        void snap.b
        throw promise
      }
      return <div>Count: {snap.a}</div>
    }
    const App = () => {
      const [useA, setUseA] = useState(true)
      return (
        <>
          <button onClick={() => startTransition(() => setUseA(false))}>
            switch
          </button>
          <Suspense fallback="loading">
            <Component useA={useA} />
          </Suspense>
        </>
      )
    }

    render(<App />)
    fireEvent.click(screen.getByText('switch'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 0')).toBeInTheDocument()

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('should grow committed subscriptions during a suspended render', async () => {
    const state = proxy({ a: 0, b: 0 })
    const promise = new Promise<void>(() => {})
    const Child = ({ snap }: { snap: typeof state }) => {
      const [useB, setUseB] = useState(false)
      return (
        <>
          <button onClick={() => setUseB(true)}>use b</button>
          <div>Count: {useB ? snap.b : snap.a}</div>
        </>
      )
    }
    const Component = ({ suspend }: { suspend: boolean }) => {
      const snap = useSnapshot(state)
      if (suspend) {
        throw promise
      }
      return <Child snap={snap} />
    }
    const App = () => {
      const [suspend, setSuspend] = useState(false)
      return (
        <>
          <button onClick={() => startTransition(() => setSuspend(true))}>
            suspend
          </button>
          <Suspense fallback="loading">
            <Component suspend={suspend} />
          </Suspense>
        </>
      )
    }

    render(<App />)
    fireEvent.click(screen.getByText('suspend'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    fireEvent.click(screen.getByText('use b'))
    expect(screen.getByText('Count: 0')).toBeInTheDocument()

    state.b = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('should track property existence with the in operator', async () => {
    const state = proxy<{ value?: number; other: number }>({
      value: 1,
      other: 0,
    })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Value: {'value' in snap ? 'present' : 'absent'}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.other += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: absent')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should track own-property checks', async () => {
    const state = proxy<{ value?: number; other: number }>({
      value: 1,
      other: 0,
    })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return (
        <div>
          Value:{' '}
          {Object.prototype.hasOwnProperty.call(snap, 'value')
            ? 'present'
            : 'absent'}
        </div>
      )
    }

    render(<Component />)
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.other += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: absent')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should track property enumeration', async () => {
    const state = proxy<{
      first?: number
      second?: number
      nested: { count: number }
    }>({ first: 1, nested: { count: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Keys: {Object.keys(snap).join(',')}</div>
    }

    render(<Component />)
    expect(screen.getByText('Keys: first,nested')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.first = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.second = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: first,nested,second')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    delete state.first
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: nested,second')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should rerender when replacement changes key order', async () => {
    const state = proxy({ nested: { a: 1, b: 2 } })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Keys: {Object.keys(snap.nested).join(',')}</div>
    }

    render(<Component />)
    expect(screen.getByText('Keys: a,b')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested = { b: 2, a: 1 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: b,a')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should track object spread', async () => {
    const state = proxy<{ first?: number; second?: number }>({ first: 1 })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Value: {JSON.stringify({ ...snap })}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: {"first":1}')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.first = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: {"first":2}')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.second = 3
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(
      screen.getByText('Value: {"first":2,"second":3}'),
    ).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should rerender when raw assignment adds or deletes an accessed leaf', async () => {
    const state = proxy<{
      nested: { value?: number; other: number }
    }>({ nested: { value: 1, other: 0 } })
    const nested = state.nested
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Value: {snap.nested.value ?? 'missing'}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: 1')).toBeInTheDocument()

    state.nested = { other: 0 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: missing')).toBeInTheDocument()
    expect(state.nested).not.toBe(nested)

    state.nested = { value: 2, other: 0 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: 2')).toBeInTheDocument()
    expect(state.nested).not.toBe(nested)
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should follow shared children after replacement', async () => {
    const state = proxy({
      root: { a: { count: 0 }, b: { count: 1 } },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>Count: {snap.root.b.count}</div>
    }

    render(<Component />)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()

    const shared = { count: 2 }
    state.root = { a: shared, b: shared }
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('Count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
    expect(state.root.a).toBe(state.root.b)
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

  it('no extra re-renders (commits)', async () => {
    const obj = proxy({ count: 0, count2: 0 })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count: {snap.count} ({useCommitCount(1)})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count2: {snap.count2} ({useCommitCount(1)})
          </div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 1 (2)')).toBeInTheDocument()
  })

  it('no extra re-renders (render func calls in non strict mode)', async () => {
    const obj = proxy({ count: 0, count2: 0 })

    const renderFn = vi.fn()
    const Counter = () => {
      const snap = useSnapshot(obj)
      renderFn(snap.count)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const renderFn2 = vi.fn()
    const Counter2 = () => {
      const snap = useSnapshot(obj)
      renderFn2(snap.count2)
      return (
        <>
          <div>count2: {snap.count2}</div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)
    expect(renderFn).lastCalledWith(0)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(2)
    expect(renderFn2).lastCalledWith(1)

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(3)
    expect(renderFn).lastCalledWith(2)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)
  })
})

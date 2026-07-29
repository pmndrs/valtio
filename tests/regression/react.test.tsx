import { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, useSnapshot } from 'valtio'

describe('regression (react)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('circular object with non-proxy object (#375)', async () => {
    const initialObject = { count: 0 }
    const state: any = proxy(initialObject)
    state.obj = initialObject

    const Counter = () => {
      const snap = useSnapshot(state)
      return <div>count: {snap.obj ? 1 : snap.count}</div>
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('support undefined property (#439)', async () => {
    const obj = proxy({ prop: undefined })

    expect('prop' in obj).toBe(true)

    const Component = () => {
      const snap = useSnapshot(obj)
      return <div>has prop: {JSON.stringify('prop' in snap)}</div>
    }

    render(
      <StrictMode>
        <Component />
      </StrictMode>,
    )

    expect(screen.getByText('has prop: true')).toBeInTheDocument()
  })

  it('sync snapshot between nested components (#460)', async () => {
    const obj = proxy<{
      id: 'prop1' | 'prop2'
      prop1: string
      prop2?: string
    }>({ id: 'prop1', prop1: 'value1' })

    const Child = ({ id }: { id: 'prop1' | 'prop2' }) => {
      const snap = useSnapshot(obj)
      return <div>Child: {snap[id]}</div>
    }

    const handleClick = () => {
      obj.prop2 = 'value2'
      obj.id = 'prop2'
    }

    const Parent = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>Parent: {snap[snap.id]}</div>
          <Child id={snap.id} />
          <button onClick={handleClick}>button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Parent />
      </StrictMode>,
    )

    expect(screen.getByText('Parent: value1')).toBeInTheDocument()
    expect(screen.getByText('Child: value1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Parent: value2')).toBeInTheDocument()
    expect(screen.getByText('Child: value2')).toBeInTheDocument()
  })

  it('respects property enumerability (#726)', async () => {
    const x = proxy(Object.defineProperty({ a: 1 }, 'b', { value: 2 }))

    expect(Object.keys(snapshot(x))).toEqual(Object.keys(x))
  })

  it('stable snapshot object (#985)', async () => {
    const state = proxy({ count: 0, obj: {} })

    let effectCount = 0

    const TestComponent = () => {
      const { count, obj } = useSnapshot(state)
      useEffect(() => {
        ++effectCount
      }, [obj])
      return (
        <>
          <div>count: {count}</div>
          <button onClick={() => ++state.count}>button</button>
        </>
      )
    }

    render(<TestComponent />)

    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(effectCount).toBe(1)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(effectCount).toBe(1)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(effectCount).toBe(1)
  })

  it('should not commit stale value for newly accessed keys on local rerender (regression in #1176)', async () => {
    const obj = proxy({ count: 0, anotherValue: 0 })

    const commitFn = vi.fn()
    const Component = () => {
      const [showAnotherValue, setShowAnotherValue] = useState(false)
      const snap = useSnapshot(obj)
      const value = showAnotherValue ? snap.anotherValue : 'hidden'
      useLayoutEffect(() => {
        commitFn(value)
      }, [value])
      return (
        <>
          <div>count: {snap.count}</div>
          {showAnotherValue && <div>anotherValue: {snap.anotherValue}</div>}
          <button onClick={() => setShowAnotherValue(true)}>
            showAnotherValue
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(screen.queryByText('anotherValue: 0')).not.toBeInTheDocument()
    expect(screen.queryByText('anotherValue: 1')).not.toBeInTheDocument()
    expect(commitFn).toBeCalledTimes(1)
    expect(commitFn).toHaveBeenNthCalledWith(1, 'hidden')

    obj.anotherValue += 1

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(commitFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('showAnotherValue'))

    expect(screen.getByText('anotherValue: 1')).toBeInTheDocument()
    expect(commitFn.mock.calls.map(([value]) => value)).toEqual(['hidden', 1])
  })
})

import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

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
})

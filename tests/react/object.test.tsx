import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('object', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('object in object', async () => {
    const obj = proxy({ object: { count: 0 } })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.object.count}</div>
          <button onClick={() => ++obj.object.count}>button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  // The counter example creates the proxy without `nested`, assigns it right
  // after, and reads it optionally in the component.
  it('property added after creation', async () => {
    const obj = proxy<{ count: number; nested?: { ticks: number } }>({
      count: 0,
    })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return <div>ticks: {snap.nested?.ticks ?? 'none'}</div>
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('ticks: none')).toBeInTheDocument()

    obj.nested = { ticks: 0 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('ticks: 0')).toBeInTheDocument()

    obj.nested.ticks += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('ticks: 1')).toBeInTheDocument()
  })

  it('deleting property', async () => {
    const obj = proxy<{ count?: number }>({ count: 1 })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count ?? 'none'}</div>
          <button onClick={() => delete obj.count}>button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: none')).toBeInTheDocument()
  })
})

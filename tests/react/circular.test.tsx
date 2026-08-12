import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('circular', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('circular object', async () => {
    const obj = proxy<any>({ object: {} })
    obj.object = obj
    obj.object.count = 0

    const Counter = () => {
      const snap = useSnapshot(obj) as any
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
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
})

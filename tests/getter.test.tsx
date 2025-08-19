import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('getter', () => {
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

  it('simple object getters', async () => {
    const computeDouble = vi.fn((x: number) => x * 2)
    const state = proxy({
      count: 0,
      get doubled() {
        return computeDouble(this.count)
      },
    })

    const Counter = ({ name }: { name: string }) => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>
            {name} count: {snap.doubled}
          </div>
          <button onClick={() => ++state.count}>{name} button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter name="A" />
        <Counter name="B" />
      </StrictMode>,
    )

    expect(screen.getByText('A count: 0')).toBeInTheDocument()
    expect(screen.getByText('B count: 0')).toBeInTheDocument()

    computeDouble.mockClear()

    fireEvent.click(screen.getByText('A button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('A count: 2')).toBeInTheDocument()
    expect(screen.getByText('B count: 2')).toBeInTheDocument()
    expect(computeDouble).toBeCalledTimes(4)
  })

  it('object getters returning object', async () => {
    const computeDouble = vi.fn((x: number) => x * 2)
    const state = proxy({
      count: 0,
      get doubled() {
        return { value: computeDouble(this.count) }
      },
    })

    const Counter = ({ name }: { name: string }) => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>
            {name} count: {snap.doubled.value}
          </div>
          <button onClick={() => ++state.count}>{name} button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter name="A" />
        <Counter name="B" />
      </StrictMode>,
    )

    expect(screen.getByText('A count: 0')).toBeInTheDocument()
    expect(screen.getByText('B count: 0')).toBeInTheDocument()

    computeDouble.mockClear()

    fireEvent.click(screen.getByText('A button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('A count: 2')).toBeInTheDocument()
    expect(screen.getByText('B count: 2')).toBeInTheDocument()
    expect(computeDouble).toBeCalledTimes(4)
  })
})

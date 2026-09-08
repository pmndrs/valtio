import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('array', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('array in object', async () => {
    const obj = proxy({ counts: [0, 1, 2] })

    const Counter = () => {
      const tracked = useSnapshot(obj)
      return (
        <>
          <div>counts: {tracked.counts.join(',')}</div>
          <button onClick={() => obj.counts.push(obj.counts.length)}>
            button
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('counts: 0,1,2,3')).toBeInTheDocument()
  })

  it('array pop and splice', async () => {
    const arr = proxy([0, 1, 2])

    const Counter = () => {
      const tracked = useSnapshot(arr)
      return (
        <>
          <div>counts: {tracked.join(',')}</div>
          <button onClick={() => arr.pop()}>button</button>
          <button onClick={() => arr.splice(1, 0, 10, 11)}>button2</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('counts: 0,1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('counts: 0,10,11,1')).toBeInTheDocument()
  })

  it('array length after direct assignment', async () => {
    const obj = proxy({ counts: [0, 1, 2] })

    const Counter = () => {
      const tracked = useSnapshot(obj)
      return (
        <>
          <div>counts: {tracked.counts.join(',')}</div>
          <div>length: {tracked.counts.length}</div>
          <button
            onClick={() => (obj.counts[obj.counts.length] = obj.counts.length)}
          >
            increment
          </button>
          <button
            onClick={() =>
              (obj.counts[obj.counts.length + 5] = obj.counts.length + 5)
            }
          >
            jump
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('counts: 0,1,2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('increment'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('counts: 0,1,2,3')).toBeInTheDocument()

    fireEvent.click(screen.getByText('jump'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('counts: 0,1,2,3,,,,,,9')).toBeInTheDocument()
  })

  it('array truncation updates an accessed index', async () => {
    const state = proxy([0, 1, 2])

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>value: {tracked[2] ?? 'missing'}</div>
    }

    render(<Component />)
    expect(screen.getByText('value: 2')).toBeInTheDocument()

    state.length = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: missing')).toBeInTheDocument()
  })
})

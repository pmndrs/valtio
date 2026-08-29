import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { useCommitCount } from '../test-utils.js'

describe('basic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('simple counter', async () => {
    const obj = proxy({ count: 0 })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const { unmount } = render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    unmount()
  })

  it('render from outside', async () => {
    const obj = proxy({ count: 0, anotherCount: 0 })

    const Counter = () => {
      const [show, setShow] = useState(false)
      const snap = useSnapshot(obj)
      return (
        <>
          {show ? (
            <div>count: {snap.count}</div>
          ) : (
            <div>anotherCount: {snap.anotherCount}</div>
          )}
          <button onClick={() => ++obj.count}>button</button>
          <button onClick={() => setShow((x) => !x)}>toggle</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('anotherCount: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    fireEvent.click(screen.getByText('toggle'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('counter with sync option', async () => {
    const obj = proxy({ count: 0 })

    const Counter = () => {
      const snap = useSnapshot(obj, { sync: true })
      return (
        <>
          <div>
            count: {snap.count} ({useCommitCount(1)})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    render(
      <>
        <Counter />
      </>,
    )

    expect(screen.getByText('count: 0 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2 (3)')).toBeInTheDocument()
  })
})

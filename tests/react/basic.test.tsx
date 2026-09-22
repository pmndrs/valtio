import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, useSnapshot } from 'valtio'
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
      const tracked = useSnapshot(obj)
      return (
        <>
          <div>count: {tracked.count}</div>
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

  it.each([false, true])(
    'should update a leaf reached through a cyclic path (sync: %s)',
    async (sync) => {
      type State = { b: { a: State }; c: { count: number } }
      const raw = {} as State
      raw.b = { a: raw }
      raw.c = { count: 0 }
      const state = proxy(raw)
      const previous = snapshot(state)
      const Component = () => {
        const tracked = useSnapshot(state, { sync })
        return <div>count: {tracked.b.a.c.count}</div>
      }

      render(<Component />)
      expect(screen.getByText('count: 0')).toBeInTheDocument()

      await act(async () => {
        state.c.count = 1
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('count: 1')).toBeInTheDocument()
      const snap = snapshot(state)
      expect(snap.b.a).toBe(snap)
      expect(previous.b.a.c.count).toBe(0)
    },
  )

  it('render from outside', async () => {
    const obj = proxy({ count: 0, anotherCount: 0 })

    const Counter = () => {
      const [show, setShow] = useState(false)
      const tracked = useSnapshot(obj)
      return (
        <>
          {show ? (
            <div>count: {tracked.count}</div>
          ) : (
            <div>anotherCount: {tracked.anotherCount}</div>
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

  it.each([
    [
      'transparent Proxy',
      (state: { count: number }): typeof state => new Proxy(state, {}),
    ],
    ['Valtio proxy', (state: { count: number }): typeof state => proxy(state)],
  ] as const)(
    'updates when a proxy wrapper changes the state (%s)',
    async (_name, wrap) => {
      const state = proxy({ count: 0 })
      const wrapped = wrap(state)
      const Counter = () => {
        const tracked = useSnapshot(state)
        return <div>count: {tracked.count}</div>
      }

      render(<Counter />)
      expect(screen.getByText('count: 0')).toBeInTheDocument()

      wrapped.count = 1
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 1')).toBeInTheDocument()
    },
  )

  it('counter with sync option', async () => {
    const obj = proxy({ count: 0 })

    const Counter = () => {
      const tracked = useSnapshot(obj, { sync: true })
      return (
        <>
          <div>
            count: {tracked.count} ({useCommitCount(1)})
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

  it.each([
    ['frozen', (value: object) => Object.freeze(value)],
    ['sealed', (value: object) => Object.seal(value)],
  ] as const)('rejects %s snapshots', (_, lock) => {
    const state = proxy({ nested: { count: 0 } })
    const snap = snapshot(state)
    lock(snap)

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>count: {tracked.nested.count}</div>
    }

    expect(() => render(<Component />)).toThrow(
      'non-extensible snapshots are not supported',
    )
  })
})

import { StrictMode } from 'react'
import type { ReactElement } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'
import { useCommitCount } from './utils'

describe('ref', () => {
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

  it('should trigger re-render setting objects with ref wrapper', async () => {
    const obj = proxy({ nested: ref({ count: 0 }) })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count: {snap.nested.count} ({useCommitCount(1)})
          </div>
          <button onClick={() => (obj.nested = ref({ count: 0 }))}>
            button
          </button>
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
    expect(screen.getByText('count: 0 (2)')).toBeInTheDocument()
  })

  it('should not track object wrapped in ref assigned to proxy state', async () => {
    const obj = proxy<{ ui: ReactElement | null }>({ ui: null })

    const Component = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          {snap.ui || <span>original</span>}
          <button onClick={() => (obj.ui = ref(<span>replace</span>))}>
            button
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <Component />
      </StrictMode>,
    )

    expect(screen.getByText('original')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('replace')).toBeInTheDocument()
  })

  it('should not trigger re-render when mutating object wrapped in ref', async () => {
    const obj = proxy({ nested: ref({ count: 0 }) })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.nested.count}</div>
          <button onClick={() => ++obj.nested.count}>button</button>
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
    expect(screen.getByText('count: 0')).toBeInTheDocument()
  })

  it('should not update snapshot or notify subscription when mutating proxy wrapped in ref', async () => {
    const obj = proxy({ nested: ref(proxy({ count: 0 })) })

    const snap1 = snapshot(obj)
    ++obj.nested.count
    const snap2 = snapshot(obj)
    expect(snap2).toBe(snap1)

    const callback = vi.fn()
    subscribe(obj, callback)
    ++obj.nested.count
    expect(callback).not.toBeCalled()
  })
})

import { StrictMode } from 'react'
import type { ReactElement } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'
import { useCommitCount } from '../test-utils'

describe('ref', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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

  it('should not wrap a proxy wrapped in ref', async () => {
    const child = ref(proxy({ count: 0 }))
    const state = proxy({ nested: child })
    const renderFn = vi.fn()
    let nested: object | undefined

    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      nested = snap.nested
      return <div>count: {snap.nested.count}</div>
    }

    render(<Component />)
    expect(nested).toBe(child)

    child.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested = ref(proxy({ count: 2 }))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['object', false],
    ['object', true],
    ['proxy', false],
    ['proxy', true],
  ] as const)(
    'should subscribe after replacing a ref %s with its proxy (sync: %s)',
    async (kind, sync) => {
      const value = ref(kind === 'object' ? { count: 0 } : proxy({ count: 0 }))
      const state = proxy<{ child: { count: number } }>({ child: value })
      const renderFn = vi.fn()
      const Component = () => {
        const snap = useSnapshot(state, { sync })
        renderFn()
        return <div>count: {snap.child.count}</div>
      }

      render(<Component />)
      expect(screen.getByText('count: 0')).toBeInTheDocument()

      await act(async () => {
        state.child = proxy(value)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(renderFn).toHaveBeenCalledTimes(2)

      await act(async () => {
        state.child.count++
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('count: 1')).toBeInTheDocument()
      expect(renderFn).toHaveBeenCalledTimes(3)
    },
  )
})

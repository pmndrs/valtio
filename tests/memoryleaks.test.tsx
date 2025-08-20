import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LeakDetector from 'jest-leak-detector'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, subscribe, useSnapshot } from 'valtio'

describe('no memory leaks with proxy', () => {
  it('empty object', async () => {
    let state = proxy({})
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let state = proxy({ child: {} })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    const child = {}
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    const child = proxy({})
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let state = proxy({} as { child?: unknown })
    state.child = state
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let state = proxy({ child: {} as { child?: unknown } })
    state.child.child = state
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })
})

describe('no memory leaks with proxy with subscription', () => {
  it('empty object', async () => {
    let state = proxy({})
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let state = proxy({ child: {} })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    const child = {}
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    const child = proxy({})
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let state = proxy({} as { child?: unknown })
    state.child = state
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let state = proxy({ child: {} as { child?: unknown } })
    state.child.child = state
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })
})

describe('no memory leaks with proxy with useSnapshot', () => {
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

  it('simple counter', async () => {
    let state = proxy({ count: 0 })
    const stateDetector = new LeakDetector(state)

    const Counter = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++state.count}>button</button>
        </>
      )
    }

    let view = render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )
    const viewDetector = new LeakDetector(view)

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()

    await act(() => view.unmount())
    view = undefined as never
    await Promise.resolve()
    expect(await viewDetector.isLeaking()).toBe(false)

    state = undefined as never
    await Promise.resolve()
    expect(await stateDetector.isLeaking()).toBe(false)
  })

  it('nested object reference change', async () => {
    let state = proxy({ nested: { count: 0 } })
    const stateDetector = new LeakDetector(state)

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

    let view = render(
      <StrictMode>
        <Component />
      </StrictMode>,
    )
    const viewDetector = new LeakDetector(view)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('button-zero'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(4)

    fireEvent.click(screen.getByText('button-one'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(6)

    await act(() => view.unmount())
    view = undefined as never
    await Promise.resolve()
    expect(await viewDetector.isLeaking()).toBe(false)

    state = undefined as never
    await Promise.resolve()
    expect(await stateDetector.isLeaking()).toBe(false)
  })

  it('proxy object change', async () => {
    let state1 = proxy({ nested: { count: 0 } })
    let state2 = proxy({ nested: { count: 10 } })
    const stateDetector1 = new LeakDetector(state1)
    const stateDetector2 = new LeakDetector(state2)

    const renderFn = vi.fn()
    const Component = () => {
      const [second, setSecond] = useState(false)
      const state = second ? state2 : state1
      const snap = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Count: {snap.nested.count}</div>
          <button
            onClick={() => {
              state.nested.count++
            }}
          >
            increment
          </button>
          <button
            onClick={() => {
              setSecond(true)
            }}
          >
            use second state
          </button>
        </>
      )
    }

    let view = render(
      <StrictMode>
        <Component />
      </StrictMode>,
    )
    const viewDetector = new LeakDetector(view)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)

    fireEvent.click(screen.getByText('increment'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(4)

    fireEvent.click(screen.getByText('use second state'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 10')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(6)

    fireEvent.click(screen.getByText('increment'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 11')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(8)

    await act(() => view.unmount())
    view = undefined as never
    await Promise.resolve()
    expect(await viewDetector.isLeaking()).toBe(false)

    state1 = undefined as never
    state2 = undefined as never
    await Promise.resolve()
    expect(await stateDetector1.isLeaking()).toBe(false)
    expect(await stateDetector2.isLeaking()).toBe(false)
  })
})

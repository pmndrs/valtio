import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { useCommitCount } from './utils'

describe('class', () => {
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

  it('simple class without methods', async () => {
    class CountClass {
      public count: number
      constructor() {
        this.count = 0
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
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

  it('no extra re-renders with class', async () => {
    class CountClass {
      public count: number
      public count2: number
      constructor() {
        this.count = 0
        this.count2 = 0
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count: {snap.count} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count2: {snap.count2} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0 (0)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 1 (1)')).toBeInTheDocument()
  })

  it('inherited class without methods', async () => {
    class BaseClass {
      public count: number
      constructor() {
        this.count = 0
      }
    }
    class CountClass extends BaseClass {
      public count2: number
      constructor() {
        super()
        this.count2 = 0
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
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

  it('class with a method', async () => {
    class CountClass {
      public count: number
      constructor() {
        this.count = 0
      }
      public doubled() {
        return this.count * 2
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            doubled: {snap.doubled()} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const snap = useSnapshot(obj)
      return (
        <div>
          count: {snap.count} ({useCommitCount()})
        </div>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('doubled: 0 (0)')).toBeInTheDocument()
    expect(screen.getByText('count: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('doubled: 2 (1)')).toBeInTheDocument()
    expect(screen.getByText('count: 1 (1)')).toBeInTheDocument()
  })

  it('inherited class with a method', async () => {
    class BaseClass {
      public count: number
      constructor() {
        this.count = 0
      }
      public doubled() {
        return this.count * 2
      }
    }
    class CountClass extends BaseClass {
      public count2: number
      constructor() {
        super()
        this.count2 = 0
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            doubled: {snap.doubled()} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count2: {snap.count2} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('doubled: 0 (0)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('doubled: 2 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('doubled: 2 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 1 (1)')).toBeInTheDocument()
  })

  it('no extra re-renders with getters', async () => {
    class CountClass {
      public count: number
      public count2: number
      constructor() {
        this.count = 0
        this.count2 = 0
      }
      get count1() {
        return this.count
      }
      get sum() {
        return this.count + this.count2
      }
    }

    const obj = proxy(new CountClass())

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            count: {snap.count1} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>
            sum: {snap.sum} ({useCommitCount()})
          </div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0 (0)')).toBeInTheDocument()
    expect(screen.getByText('sum: 0 (0)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (1)')).toBeInTheDocument()
    expect(screen.getByText('sum: 1 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (1)')).toBeInTheDocument()
    expect(screen.getByText('sum: 2 (2)')).toBeInTheDocument()
  })
})

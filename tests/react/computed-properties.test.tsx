import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, subscribe, useSnapshot } from 'valtio'

// Behavior described in docs/guides/computed-properties.mdx
describe('computed properties: object getters', () => {
  it('should recompute on the proxy and freeze the value in a snapshot', () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
    })

    expect(state.doubled).toBe(2)

    const snap = snapshot(state)
    expect(snap.doubled).toBe(2)

    state.count = 10
    expect(state.doubled).toBe(20)
    expect(snap.doubled).toBe(2)
    expect(snapshot(state).doubled).toBe(20)
  })

  it('should support setters on the proxy', () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
      set doubled(newValue: number) {
        this.count = newValue / 2
      },
    })

    state.doubled = 4
    expect(state.count).toBe(2)
    expect(snapshot(state).doubled).toBe(4)
  })

  it('should reject setter calls on a snapshot', () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
      set doubled(newValue: number) {
        this.count = newValue / 2
      },
    })

    const snap = snapshot(state)
    expect(() => {
      ;(snap as any).doubled = 2
    }).toThrow()
    expect(state.count).toBe(1)
  })

  it('should let a getter reference sibling properties through this', () => {
    const user = proxy({
      name: 'John',
      get greetingEn() {
        return `Hello ${this.name}`
      },
    })

    expect(user.greetingEn).toBe('Hello John')
    user.name = 'Jane'
    expect(user.greetingEn).toBe('Hello Jane')
  })

  it('should let a nested getter reference its own siblings', () => {
    const state = proxy({
      user: {
        name: 'John',
        get greetingEn(): string {
          return `Hello ${this.name}`
        },
      },
    })

    expect(state.user.greetingEn).toBe('Hello John')
    expect(snapshot(state).user.greetingEn).toBe('Hello John')
  })

  it('should read a foreign proxy attached as a property', () => {
    const user = proxy({ name: 'John' })
    const greetings = proxy({
      user,
      get greetingEn(): string {
        return `Hello ${this.user.name}`
      },
    })

    expect(greetings.greetingEn).toBe('Hello John')
    user.name = 'Jane'
    expect(greetings.greetingEn).toBe('Hello Jane')
  })

  it('should support syncing a derived proxy with subscribe', async () => {
    const user = proxy({ name: 'John' })
    const greetings = proxy({ greetingEn: `Hello ${user.name}` })
    subscribe(user, () => {
      greetings.greetingEn = `Hello ${user.name}`
    })

    user.name = 'Jane'
    await Promise.resolve()
    expect(greetings.greetingEn).toBe('Hello Jane')
  })
})

describe('computed properties: class getters', () => {
  class Counter {
    count = 1
    get doubled() {
      return this.count * 2
    }
    set doubled(newValue: number) {
      this.count = newValue / 2
    }
  }

  it('should recompute against the snapshot rather than caching', () => {
    const state = proxy(new Counter())
    const snap = snapshot(state)

    state.doubled = 4
    expect(state.count).toBe(2)
    expect(snap.doubled).toBe(2)
  })

  it('should fail when a class setter mutates a snapshot', () => {
    const state = proxy(new Counter())
    const snap = snapshot(state)

    expect(() => {
      ;(snap as any).doubled = 8
    }).toThrow()
    expect(state.count).toBe(1)
  })
})

describe('computed properties: in React', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should re-render when a dependency of the getter changes', async () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
    })

    const Component = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>doubled: {snap.doubled}</div>
          <button onClick={() => ++state.count}>button</button>
        </>
      )
    }

    render(<Component />)
    expect(screen.getByText('doubled: 2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('doubled: 4')).toBeInTheDocument()
  })

  it('should not re-render when an unrelated property changes', async () => {
    const state = proxy({
      count: 1,
      text: 'hello',
      get doubled() {
        return this.count * 2
      },
    })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>doubled: {snap.doubled}</div>
    }

    render(<Component />)
    expect(renderFn).toBeCalledTimes(1)

    state.text = 'world'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(1)
  })
})

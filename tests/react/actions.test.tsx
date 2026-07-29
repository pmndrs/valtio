import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { deepClone } from 'valtio/utils'

// Behavior described in docs/how-tos/how-to-organize-actions.mdx
describe('organizing actions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderCounter = (state: { count: number }, inc: () => void) => {
    const Component = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={inc}>button</button>
        </>
      )
    }
    render(<Component />)
  }

  const clickButton = () => fireEvent.click(screen.getByText('button'))

  it('should support action functions defined in a module', async () => {
    const state = proxy({ count: 0, name: 'foo' })
    const inc = () => {
      ++state.count
    }

    renderCounter(state, inc)
    clickButton()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('should support an action object defined in a module', async () => {
    const state = proxy({ count: 0, name: 'foo' })
    const actions = {
      inc: () => {
        ++state.count
      },
      setName: (name: string) => {
        state.name = name
      },
    }

    renderCounter(state, actions.inc)
    clickButton()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()

    actions.setName('bar')
    expect(state.name).toBe('bar')
  })

  it('should support action methods stored in the state', async () => {
    const state: {
      count: number
      name: string
      inc: () => void
      setName: (name: string) => void
    } = proxy({
      count: 0,
      name: 'foo',
      inc: () => {
        ++state.count
      },
      setName: (name: string) => {
        state.name = name
      },
    })

    renderCounter(state, () => state.inc())
    clickButton()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('should support action methods using this', async () => {
    const state = proxy({
      count: 0,
      name: 'foo',
      inc() {
        ++this.count
      },
      setName(name: string) {
        this.name = name
      },
    })

    renderCounter(state, () => state.inc())
    clickButton()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()

    state.setName('bar')
    expect(state.name).toBe('bar')
  })

  it('should support a class instance', async () => {
    class State {
      count = 0
      name = 'foo'
      inc() {
        ++this.count
      }
      setName(name: string) {
        this.name = name
      }
    }
    const state = proxy(new State())

    renderCounter(state, () => state.inc())
    clickButton()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()

    state.setName('bar')
    expect(state.name).toBe('bar')
  })
})

// Behavior described in docs/how-tos/how-to-reset-state.mdx
describe('resetting state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const initialObj = {
    text: 'hello',
    arr: [1, 2, 3],
    obj: { a: 'b' },
  }

  it('should reset by reassigning each key from a fresh clone', async () => {
    const state = proxy(deepClone(initialObj))
    const reset = () => {
      const resetObj = deepClone(initialObj)
      Object.keys(resetObj).forEach((key) => {
        state[key as keyof typeof resetObj] = resetObj[
          key as keyof typeof resetObj
        ] as never
      })
    }

    const Component = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>text: {snap.text}</div>
          <div>arr: {snap.arr.join(',')}</div>
          <button onClick={reset}>reset</button>
        </>
      )
    }

    render(<Component />)

    state.text = 'changed'
    state.arr.push(4)
    state.obj.a = 'c'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('text: changed')).toBeInTheDocument()
    expect(screen.getByText('arr: 1,2,3,4')).toBeInTheDocument()

    fireEvent.click(screen.getByText('reset'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('text: hello')).toBeInTheDocument()
    expect(screen.getByText('arr: 1,2,3')).toBeInTheDocument()
    expect(state.obj.a).toBe('b')
  })

  it('should reset a nested holder in one assignment', async () => {
    const state = proxy({ obj: deepClone(initialObj) })
    const reset = () => {
      state.obj = deepClone(initialObj)
    }

    const Component = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>text: {snap.obj.text}</div>
          <button onClick={reset}>reset</button>
        </>
      )
    }

    render(<Component />)

    state.obj.text = 'changed'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('text: changed')).toBeInTheDocument()

    fireEvent.click(screen.getByText('reset'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('text: hello')).toBeInTheDocument()
  })

  it('should keep the initial object untouched when cloned', () => {
    const state = proxy(deepClone(initialObj))
    state.text = 'changed'
    state.arr.push(4)
    expect(initialObj.text).toBe('hello')
    expect(initialObj.arr).toEqual([1, 2, 3])
  })
})

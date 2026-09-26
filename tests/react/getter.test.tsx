import { StrictMode, memo, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { proxyMap, proxySet } from 'valtio/utils'

describe('getter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should track object-valued dependencies', async () => {
    const state = proxy({
      left: { value: 1 },
      right: { value: 1 },
      get same() {
        return this.left === this.right
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>same: {String(tracked.same)}</div>
    }

    render(<Component />)
    expect(screen.getByText('same: false')).toBeInTheDocument()

    state.right = state.left
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('same: true')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should track nested getter dependencies', async () => {
    const computeDouble = vi.fn((x: number) => x * 2)
    const state = proxy({
      nested: { count: 0 },
      get doubled() {
        return computeDouble(this.nested.count)
      },
    })

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>count: {tracked.doubled}</div>
    }

    render(<Component />)
    computeDouble.mockClear()

    state.nested = { count: 1 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(computeDouble).toBeCalledTimes(1)

    computeDouble.mockClear()
    state.nested = proxy({ count: 2 })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 4')).toBeInTheDocument()
    expect(computeDouble).toBeCalledTimes(1)
  })

  it('should track each getter independently', async () => {
    const state = proxy({
      firstCount: 1,
      secondCount: 1,
      get first() {
        return this.firstCount
      },
      get second() {
        return this.secondCount
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>count: {tracked.first}</div>
    }

    render(<Component />)
    state.secondCount = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.firstCount = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should render updated values from getter-returned closures', async () => {
    // In v2, function identity alone can trigger this render.
    const state = proxy({
      count: 1,
      get select() {
        return () => this.count
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return (
        <div>
          values: {tracked.select()},{tracked.select()}
        </div>
      )
    }

    render(<Component />)
    expect(screen.getByText('values: 1,1')).toBeInTheDocument()
    state.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('values: 2,2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should update a getter that calls a getter-returned closure', async () => {
    const state = proxy({
      count: 1,
      unrelated: 0,
      get select() {
        return () => this.count
      },
      get doubled() {
        return this.select() * 2
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>doubled: {tracked.doubled}</div>
    }

    render(<Component />)
    expect(screen.getByText('doubled: 2')).toBeInTheDocument()

    state.unrelated++
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('doubled: 4')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should track deeply nested getter dependencies', async () => {
    const state = proxy({
      nested: { deeply: { count: 0, other: 0 } },
      get doubled() {
        return this.nested.deeply.count * 2
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>count: {tracked.doubled}</div>
    }

    render(<Component />)
    state.nested.deeply.other = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.deeply.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should merge getter and direct dependencies on the same proxy', async () => {
    const state = proxy({
      nested: { a: 1, b: 1 },
      get selected() {
        return this.nested.a
      },
    })

    const Component = () => {
      const tracked = useSnapshot(state)
      return (
        <div>
          values: {tracked.selected},{tracked.nested.b}
        </div>
      )
    }

    render(<Component />)
    state.nested.a = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('values: 2,1')).toBeInTheDocument()
  })

  it('should update dynamic getter dependencies', async () => {
    const state = proxy({
      a: 1,
      b: 2,
      c: true,
      get d() {
        return this.c ? this.a : this.b
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>value: {tracked.d}</div>
    }

    render(<Component />)
    state.a = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.b = 3
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.c = false
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 3')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)

    state.a = 4
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)

    state.b = 5
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 5')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(4)
  })

  it('should preserve direct usage of a getter dependency', async () => {
    const state = proxy({
      nested: { count: 0 },
      get parity() {
        return this.nested.count % 2
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return (
        <div>
          value: {tracked.parity},{tracked.nested.count}
        </div>
      )
    }

    render(<Component />)
    state.nested.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 0,2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should compare descriptor values used by getters', async () => {
    const state = proxy({
      nested: { count: 1 },
      get doubled() {
        const descriptor = Object.getOwnPropertyDescriptor(this.nested, 'count')
        return (descriptor?.value as number) * 2
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>value: {tracked.doubled}</div>
    }

    render(<Component />)
    expect(screen.getByText('value: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 4')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should compare descriptor values used by class getters', async () => {
    class State {
      nested = { count: 1 }

      get doubled() {
        const descriptor = Object.getOwnPropertyDescriptor(this.nested, 'count')
        return (descriptor?.value as number) * 2
      }
    }
    const state = proxy(new State())

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>value: {tracked.doubled}</div>
    }

    render(<Component />)
    expect(screen.getByText('value: 2')).toBeInTheDocument()

    state.nested.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 4')).toBeInTheDocument()
  })

  it.each(['own', 'inherited'])(
    'should track nested descriptor reads in %s getters',
    async (kind) => {
      const properties = {
        get doubled() {
          const descriptor = Object.getOwnPropertyDescriptor(this, 'child')
          return (descriptor?.value as { count: number }).count * 2
        },
      }
      const state = proxy(
        kind === 'own'
          ? Object.defineProperties(
              { child: { count: 1, other: 0 } },
              Object.getOwnPropertyDescriptors(properties),
            )
          : Object.assign(Object.create(properties), {
              child: { count: 1, other: 0 },
            }),
      ) as { child: { count: number; other: number }; doubled: number }
      const renderFn = vi.fn()
      const Component = () => {
        const tracked = useSnapshot(state)
        renderFn()
        return <div>value: {tracked.doubled}</div>
      }

      render(<Component />)
      expect(screen.getByText('value: 2')).toBeInTheDocument()

      state.child.other = 1
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(renderFn).toHaveBeenCalledTimes(1)

      state.child.count = 2
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('value: 4')).toBeInTheDocument()

      state.child = proxy({ count: 3, other: 0 })
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('value: 6')).toBeInTheDocument()
    },
  )

  it('should track deletion of a getter', async () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
    })

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>value: {String(tracked.doubled)}</div>
    }

    render(<Component />)
    expect(screen.getByText('value: 2')).toBeInTheDocument()

    delete (state as { doubled?: number }).doubled
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: undefined')).toBeInTheDocument()
  })

  it('should retain getter dependencies when a memoized child bails out', async () => {
    const state = proxy({
      nested: { count: 0 },
      get doubled() {
        return this.nested.count * 2
      },
    })
    const childRender = vi.fn()
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: { readonly doubled: number }
    }) {
      childRender()
      return <div>value: {tracked.doubled}</div>
    })
    const Parent = () => {
      const [, rerender] = useState(0)
      const tracked = useSnapshot(state)
      return (
        <>
          <button onClick={() => rerender((value) => value + 1)}>
            rerender
          </button>
          <Child tracked={tracked} />
        </>
      )
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('rerender'))
    expect(childRender).toHaveBeenCalledTimes(1)

    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 2')).toBeInTheDocument()
    expect(childRender).toHaveBeenCalledTimes(2)
  })

  it('should retain inherited getter dependencies when a memoized child bails out', async () => {
    class State {
      nested = { count: 0, other: 0 }
      get doubled() {
        return this.nested.count * 2
      }
    }
    const state = proxy(new State())
    const childRender = vi.fn()
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: { readonly doubled: number }
    }) {
      childRender()
      return <div>value: {tracked.doubled}</div>
    })
    const Parent = () => {
      const [, rerender] = useState(0)
      const tracked = useSnapshot(state)
      return (
        <>
          <button onClick={() => rerender((value) => value + 1)}>
            rerender
          </button>
          <Child tracked={tracked} />
        </>
      )
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('rerender'))
    expect(childRender).toHaveBeenCalledTimes(1)
    state.nested.other = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(childRender).toHaveBeenCalledTimes(1)
    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: 2')).toBeInTheDocument()
    expect(childRender).toHaveBeenCalledTimes(2)
  })

  it('should track properties read from a proxy returned by a getter', async () => {
    const state = proxy({
      nested: { count: 0, other: 0 },
      get selected() {
        return this.nested
      },
    })
    const renderFn = vi.fn()

    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>count: {tracked.selected.count}</div>
    }

    render(<Component />)
    state.nested.other = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should track a proxyMap used by a getter', async () => {
    const state = proxy({
      items: proxyMap<string, number>(),
      get size() {
        return this.items.size
      },
    })

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>size: {tracked.size}</div>
    }

    render(<Component />)
    expect(screen.getByText('size: 0')).toBeInTheDocument()

    state.items.set('one', 1)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('size: 1')).toBeInTheDocument()
  })

  it('should track a proxySet used by a getter', async () => {
    const state = proxy({
      items: proxySet<number>(),
      get size() {
        return this.items.size
      },
    })

    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>size: {tracked.size}</div>
    }

    render(<Component />)
    expect(screen.getByText('size: 0')).toBeInTheDocument()

    state.items.add(1)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('size: 1')).toBeInTheDocument()
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
      const tracked = useSnapshot(state)
      return (
        <>
          <div>
            {name} count: {tracked.doubled}
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
    expect(computeDouble).toBeCalledTimes(1)
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
      const tracked = useSnapshot(state)
      return (
        <>
          <div>
            {name} count: {tracked.doubled.value}
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
    expect(computeDouble).toBeCalledTimes(1)
  })
})

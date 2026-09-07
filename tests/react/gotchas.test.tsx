import { memo, useEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, subscribe, useSnapshot } from 'valtio'

// Behavior described in docs/how-tos/some-gotchas.mdx
describe('gotchas: property access decides the re-render scope', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should re-render only for the leaf that was accessed', async () => {
    const state = proxy({ obj: { count: 0, text: 'hello' } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>count: {snap.obj.count}</div>
    }

    render(<Component />)
    expect(renderFn).toBeCalledTimes(1)

    state.obj.text = 'world'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(1)

    state.obj.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(2)
  })

  it('should re-render for any inner change when only the object is accessed', async () => {
    const state = proxy({ obj: { count: 0, text: 'hello' } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      const obj = snap.obj
      renderFn()
      return <div>obj: {obj ? 'present' : 'absent'}</div>
    }

    render(<Component />)
    expect(renderFn).toBeCalledTimes(1)

    state.obj.text = 'world'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(2)

    state.obj.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(3)
  })

  it('should behave the same when snapshotting the inner proxy without property access', async () => {
    const state = proxy({ obj: { count: 0, text: 'hello' } })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state.obj)
      renderFn()
      return <div>obj: {snap ? 'present' : 'absent'}</div>
    }

    render(<Component />)
    expect(renderFn).toBeCalledTimes(1)

    state.obj.text = 'world'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(2)
  })
})

describe('gotchas: state versus snap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should mutate through the proxy from a callback while rendering from the snapshot', async () => {
    const state = proxy({ count: 0 })

    const Component = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++state.count}>button</button>
        </>
      )
    }

    render(<Component />)
    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('should not re-render when the proxy is read directly instead of the snapshot', async () => {
    const state = proxy({ count: 0 })

    const renderFn = vi.fn()
    const Component = () => {
      const { count } = state
      renderFn()
      return <div>count: {count}</div>
    }

    render(<Component />)
    expect(screen.getByText('count: 0')).toBeInTheDocument()

    state.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(1)
    expect(screen.getByText('count: 0')).toBeInTheDocument()
  })
})

describe('gotchas: sync option', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should update a controlled input within the same tick', () => {
    const state = proxy({ text: 'hello' })

    const Input = () => {
      const snap = useSnapshot(state, { sync: true })
      return (
        <input
          aria-label="text"
          value={snap.text}
          onChange={(e) => {
            state.text = e.target.value
          }}
        />
      )
    }

    render(<Input />)
    const input = screen.getByLabelText('text') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'hello world' } })
    expect(input.value).toBe('hello world')
  })

  it('should batch without the sync option', async () => {
    const state = proxy({ count: 0 })

    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>count: {snap.count}</div>
    }

    render(<Component />)
    expect(renderFn).toBeCalledTimes(1)

    state.count += 1
    state.count += 1

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(2)
    expect(screen.getByText('count: 2')).toBeInTheDocument()
  })
})

// The v1 caveat about React.memo and object props no longer applies in v2.
describe('gotchas: React.memo with object props', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should update a memoized child that receives a snapshot object', async () => {
    const state = proxy({ obj: { title: 'a', description: 'b' } })

    const Child = memo(function Child({ obj }: { obj: { title: string } }) {
      return <div>title: {obj.title}</div>
    })

    const Parent = () => {
      const snap = useSnapshot(state)
      return <Child obj={snap.obj} />
    }

    render(<Parent />)
    expect(screen.getByText('title: a')).toBeInTheDocument()

    state.obj.title = 'c'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('title: c')).toBeInTheDocument()
  })

  it('should retain reads when a memoized child receives the root snapshot', async () => {
    const state = proxy({ obj: { title: 'a' } })
    const childRender = vi.fn()

    const Child = memo(function Child({
      snap,
    }: {
      snap: { readonly obj: { readonly title: string } }
    }) {
      childRender()
      return <div>title: {snap.obj.title}</div>
    })

    const Parent = () => {
      const [, rerender] = useState(0)
      const snap = useSnapshot(state)
      return (
        <>
          <button onClick={() => rerender((value) => value + 1)}>
            rerender
          </button>
          <Child snap={snap} />
        </>
      )
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('rerender'))
    expect(childRender).toHaveBeenCalledTimes(1)

    state.obj.title = 'b'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('title: b')).toBeInTheDocument()
    expect(childRender).toHaveBeenCalledTimes(2)
  })

  it('should subscribe to keys read by an independently rendered child', async () => {
    const state = proxy({ first: 'a', second: 'b' })
    const parentRender = vi.fn()

    const Child = ({ snap }: { snap: typeof state }) => {
      const [key, setKey] = useState<'first' | 'second'>('first')
      return (
        <>
          <button onClick={() => setKey('second')}>switch</button>
          <div>value: {snap[key]}</div>
        </>
      )
    }

    const Parent = () => {
      parentRender()
      const snap = useSnapshot(state)
      return <Child snap={snap} />
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('switch'))
    expect(screen.getByText('value: b')).toBeInTheDocument()
    expect(parentRender).toHaveBeenCalledTimes(1)

    state.second = 'c'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: c')).toBeInTheDocument()
    expect(parentRender).toHaveBeenCalledTimes(2)
  })

  it('should subscribe to proxies read by an independently rendered child', async () => {
    const state = proxy({
      first: { value: 'a' },
      second: { value: 'b' },
    })

    const Child = ({ snap }: { snap: typeof state }) => {
      const [key, setKey] = useState<'first' | 'second'>('first')
      return (
        <>
          <button onClick={() => setKey('second')}>switch</button>
          <div>value: {snap[key].value}</div>
        </>
      )
    }

    const Parent = () => {
      const snap = useSnapshot(state)
      return <Child snap={snap} />
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('switch'))
    expect(screen.getByText('value: b')).toBeInTheDocument()

    state.second.value = 'c'
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('value: c')).toBeInTheDocument()
  })

  it('should update a memoized child that subscribes to the proxy it was passed', async () => {
    const state = proxy({
      objects: [
        { id: 1, label: 'foo' },
        { id: 2, label: 'bar' },
      ],
    })

    const renderFns = [vi.fn(), vi.fn()]

    const Item = memo(function Item({
      objectProxy,
      index,
    }: {
      objectProxy: { label: string }
      index: number
    }) {
      const snap = useSnapshot(objectProxy)
      renderFns[index]!()
      return <div>label: {snap.label}</div>
    })

    const List = () => {
      const snap = useSnapshot(state)
      return (
        <>
          {Array.from({ length: snap.objects.length }, (_, index) => (
            <Item
              key={state.objects[index]!.id}
              index={index}
              objectProxy={state.objects[index]!}
            />
          ))}
        </>
      )
    }

    render(<List />)
    expect(renderFns[0]).toBeCalledTimes(1)
    expect(renderFns[1]).toBeCalledTimes(1)

    state.objects[0]!.label = 'baz'
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('label: baz')).toBeInTheDocument()
    expect(renderFns[0]).toBeCalledTimes(2)
    expect(renderFns[1]).toBeCalledTimes(1)
  })
})

// docs/how-tos/how-to-avoid-rerenders-manually.mdx
describe('gotchas: opting out of useSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should allow subscribing and setting local state conditionally', async () => {
    const state = proxy({ count: 0 })

    const Component = () => {
      const [count, setCount] = useState(state.count)
      useEffect(() => {
        const callback = () => {
          if (state.count % 2 === 0) {
            setCount(state.count)
          }
        }
        const unsubscribe = subscribe(state, callback)
        callback()
        return unsubscribe
      }, [])
      return <div>count: {count}</div>
    }

    render(<Component />)
    expect(screen.getByText('count: 0')).toBeInTheDocument()

    state.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 0')).toBeInTheDocument()

    state.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
  })
})

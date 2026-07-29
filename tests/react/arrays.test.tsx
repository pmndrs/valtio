import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

// Behavior described in docs/how-tos/how-to-update-values-inside-arrays.mdx
describe('updating values inside arrays', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createState = () =>
    proxy({
      title: 'My Counter list',
      items: [
        { id: 1, count: 0 },
        { id: 2, count: 0 },
      ],
    })

  it('should re-render the whole list when the parent maps over the snapshot', async () => {
    const state = createState()

    const listRenderFn = vi.fn()
    const itemRenderFn = vi.fn()

    const Counter = ({ item }: { item: { id: number; count: number } }) => {
      itemRenderFn(item.id)
      return <div>{`item ${item.id}: ${item.count}`}</div>
    }

    const CounterList = () => {
      const snap = useSnapshot(state)
      listRenderFn()
      return (
        <>
          <h1>{snap.title}</h1>
          {snap.items.map((item) => (
            <Counter key={item.id} item={item} />
          ))}
        </>
      )
    }

    render(<CounterList />)
    expect(listRenderFn).toBeCalledTimes(1)
    expect(itemRenderFn).toBeCalledTimes(2)

    state.items[0]!.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('item 1: 1')).toBeInTheDocument()
    expect(listRenderFn).toBeCalledTimes(2)
    expect(itemRenderFn).toBeCalledTimes(4)
  })

  it('should re-render only the changed item when children take the proxy', async () => {
    const state = createState()

    const listRenderFn = vi.fn()
    const itemRenderFn = vi.fn()

    const Counter = ({ item }: { item: { id: number; count: number } }) => {
      const snap = useSnapshot(item)
      itemRenderFn(snap.id)
      return <div>{`item ${snap.id}: ${snap.count}`}</div>
    }

    const CounterList = () => {
      const snap = useSnapshot(state)
      listRenderFn()
      return (
        <>
          <h1>{snap.title}</h1>
          {Array.from({ length: snap.items.length }, (_, index) => (
            <Counter key={state.items[index]!.id} item={state.items[index]!} />
          ))}
        </>
      )
    }

    render(<CounterList />)
    expect(listRenderFn).toBeCalledTimes(1)
    expect(itemRenderFn).toBeCalledTimes(2)

    state.items[0]!.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('item 1: 1')).toBeInTheDocument()
    expect(listRenderFn).toBeCalledTimes(1)
    expect(itemRenderFn).toBeCalledTimes(3)
  })

  it('should re-render the list when its length changes', async () => {
    const state = createState()

    const listRenderFn = vi.fn()

    const CounterList = () => {
      const snap = useSnapshot(state)
      listRenderFn()
      return <div>count: {snap.items.length}</div>
    }

    render(<CounterList />)
    expect(listRenderFn).toBeCalledTimes(1)

    state.items.push({ id: 3, count: 0 })
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('count: 3')).toBeInTheDocument()
    expect(listRenderFn).toBeCalledTimes(2)
  })

  it('should mutate an item through the proxy from a child callback', async () => {
    const state = createState()

    const Counter = ({ item }: { item: { id: number; count: number } }) => {
      const snap = useSnapshot(item)
      return (
        <>
          <div>{`item ${snap.id}: ${snap.count}`}</div>
          <button onClick={() => item.count++}>{`inc ${snap.id}`}</button>
        </>
      )
    }

    const CounterList = () => {
      const snap = useSnapshot(state)
      return (
        <>
          {Array.from({ length: snap.items.length }, (_, index) => (
            <Counter key={state.items[index]!.id} item={state.items[index]!} />
          ))}
        </>
      )
    }

    render(<CounterList />)

    fireEvent.click(screen.getByText('inc 2'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('item 1: 0')).toBeInTheDocument()
    expect(screen.getByText('item 2: 1')).toBeInTheDocument()
    expect(state.items[1]!.count).toBe(1)
  })
})

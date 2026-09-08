import { memo, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import type { Snapshot } from 'valtio'

describe('container tracking', () => {
  it('rechecks a container discovered after an unused mutation', async () => {
    const state = proxy({ obj: { count: 1 } })
    let observed: object | null = null
    const Child = ({ tracked }: { tracked: Snapshot<typeof state> }) => {
      const [visible, setVisible] = useState(false)
      const obj = visible ? tracked.obj : null
      useLayoutEffect(() => {
        observed = obj
      }, [obj])
      return <button onClick={() => setVisible(true)}>show</button>
    }
    const Component = () => <Child tracked={useSnapshot(state)} />
    render(<Component />)
    await act(async () => {
      state.obj.count = 2
    })
    fireEvent.click(screen.getByText('show'))
    await act(() => Promise.resolve())
    expect(observed).toEqual({ count: 2 })
  })

  it('keeps skipped child reads alongside fresh parent reads of the same snapshot', async () => {
    const state = proxy({ a: 1, b: 2 })
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: Snapshot<typeof state>
    }) {
      return <div>child: {tracked.b}</div>
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      const [count, setCount] = useState(0)
      return (
        <>
          <button onClick={() => setCount(count + 1)}>
            {tracked.a}: {count}
          </button>
          <Child tracked={tracked} />
        </>
      )
    }
    render(<Component />)
    fireEvent.click(screen.getByRole('button'))
    await act(async () => {
      state.b++
    })
    expect(screen.getByText('child: 3')).toBeInTheDocument()
  })

  it('updates an object identity comparison after a descendant mutation', async () => {
    const state = proxy({ obj: { nested: { count: 1 } } })
    let savedObj: object | undefined
    const Component = () => {
      const tracked = useSnapshot(state)
      savedObj ||= tracked.obj
      return <div>{tracked.obj === savedObj ? 'same' : 'different'}</div>
    }
    render(<Component />)
    expect(screen.getByText('same')).toBeInTheDocument()
    await act(async () => {
      state.obj.nested.count++
    })
    expect(screen.getByText('different')).toBeInTheDocument()
  })

  it('observes arbitrary descendants of an object-only read', async () => {
    const state = proxy({ obj: { nested: { count: 1 } }, other: 0 })
    const effect = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      useLayoutEffect(effect, [tracked.obj])
      return null
    }
    render(<Component />)
    await act(async () => {
      state.obj.nested.count++
    })
    expect(effect).toHaveBeenCalledTimes(2)
    await act(async () => {
      state.other++
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('observes an array consumed as a container', async () => {
    const state = proxy({ items: [{ nested: { count: 1 } }] })
    const effect = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      useLayoutEffect(effect, [tracked.items])
      return null
    }
    render(<Component />)
    await act(async () => {
      state.items[0]!.nested.count++
    })
    expect(effect).toHaveBeenCalledTimes(2)
    await act(async () => {
      state.items.push({ nested: { count: 3 } })
    })
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('narrows ordinary traversal to the used leaf', async () => {
    const state = proxy({ obj: { nested: { count: 1, other: 0 }, other: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>{tracked.obj.nested.count}</div>
    }
    render(<Component />)
    await act(async () => {
      state.obj.other++
      state.obj.nested.other++
    })
    expect(renderFn).toHaveBeenCalledTimes(1)
    await act(async () => {
      state.obj.nested.count++
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('observes containers returned by getters', async () => {
    const state = proxy({
      obj: { nested: { count: 1 } },
      get selected() {
        return this.obj
      },
    })
    const effect = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      useLayoutEffect(effect, [tracked.selected])
      return null
    }
    render(<Component />)
    await act(async () => {
      state.obj.nested.count++
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('observes getter containers read through descriptors', async () => {
    const state = proxy({
      obj: { nested: { count: 1 } },
      get selected() {
        return Object.getOwnPropertyDescriptor(this, 'obj')!.value as {
          nested: { count: number }
        }
      },
    })
    const effect = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      useLayoutEffect(effect, [tracked.selected])
      return null
    }
    render(<Component />)
    await act(async () => {
      state.obj.nested.count++
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('retains container reads in a memoized descendant', async () => {
    const state = proxy({ obj: { nested: { count: 1 } } })
    const effect = vi.fn()
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: Snapshot<typeof state>
    }) {
      useLayoutEffect(effect, [tracked.obj])
      return null
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      const [count, setCount] = useState(0)
      return (
        <>
          <button onClick={() => setCount(count + 1)}>local {count}</button>
          <Child tracked={tracked} />
        </>
      )
    }
    render(<Component />)
    fireEvent.click(screen.getByText('local 0'))
    expect(effect).toHaveBeenCalledTimes(1)
    await act(async () => {
      state.obj.nested.count++
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })
})

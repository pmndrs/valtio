import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { applyChanges } from 'valtio/utils'

describe('applyChanges', () => {
  it('implements the requested update sequence', async () => {
    const state = proxy({ obj: { count: 1 } })
    const previous = state.obj
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>{tracked.obj.count}</div>
    }
    render(<Component />)
    await act(async () => {
      ++state.obj.count
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
    await act(async () => {
      applyChanges(state, { obj: { count: 3 } })
    })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
    expect(state.obj).toBe(previous)
    await act(async () => {
      state.obj.count = 3
    })
    await act(async () => {
      applyChanges(state, { obj: { count: 3 } })
    })
    expect(renderFn).toHaveBeenCalledTimes(3)
    await act(async () => {
      state.obj = { count: 4 }
    })
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(4)
    expect(state.obj).not.toBe(previous)
    expect(previous.count).toBe(3)
    await act(async () => {
      state.obj = { count: 4 }
    })
    expect(renderFn).toHaveBeenCalledTimes(5)
  })

  it('updates nested getters without replacing their dependencies', async () => {
    const state = proxy({
      obj: { count: 1 },
      get doubled() {
        return this.obj.count * 2
      },
    })
    const previous = state.obj
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.doubled}</div>
    }
    render(<Component />)
    await act(async () => {
      applyChanges(state.obj, { count: 2 })
    })
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(state.obj).toBe(previous)
    await act(async () => {
      state.obj = { count: 3 }
    })
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('deletes absent subtrees and wakes their readers', async () => {
    const state = proxy<{ obj?: { count: number } }>({ obj: { count: 1 } })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.obj?.count ?? 'absent'}</div>
    }
    render(<Component />)
    await act(async () => {
      applyChanges(state, {})
    })
    expect(screen.getByText('absent')).toBeInTheDocument()
  })

  it('updates arrays in place and removes trailing elements', async () => {
    const state = proxy({ items: [{ count: 1 }, { count: 2 }] })
    const previous = state.items[0]
    const Component = () => {
      const tracked = useSnapshot(state)
      return (
        <div>
          {tracked.items[0]?.count}/{tracked.items[1]?.count ?? 'absent'}
        </div>
      )
    }
    render(<Component />)
    await act(async () => {
      applyChanges(state, { items: [{ count: 3 }] })
    })
    expect(screen.getByText('3/absent')).toBeInTheDocument()
    expect(state.items[0]).toBe(previous)
    expect(state.items).toHaveLength(1)
  })
})

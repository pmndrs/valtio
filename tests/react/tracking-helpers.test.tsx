import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, snapshot } from 'valtio'
import { getUntracked, trackMemo, useSnapshot } from 'valtio/react'

describe('getUntracked', () => {
  it('should return the snapshot a tracked object wraps', () => {
    const state = proxy({ nested: { count: 0 } })
    let tracked!: { nested: { count: number } }
    const Component = () => {
      tracked = useSnapshot(state)
      return null
    }

    render(<Component />)

    expect(getUntracked(tracked)).toBe(snapshot(state))
    expect(getUntracked(tracked.nested)).toBe(snapshot(state).nested)
  })

  it('should return null for an object that is not tracked', () => {
    const state = proxy({ count: 0 })
    expect(getUntracked(snapshot(state))).toBe(null)
    expect(getUntracked({})).toBe(null)
  })
})

describe('trackMemo', () => {
  const setup = (memo: boolean) => {
    const state = proxy({ obj: { a: 0, b: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      if (memo) {
        trackMemo(tracked.obj)
      }
      renderFn(tracked.obj.a)
      return null
    }
    render(<Component />)
    return { state, renderFn }
  }

  it('should not re-render for an unread property without it', () => {
    const { state, renderFn } = setup(false)
    act(() => {
      state.obj.b += 1
    })
    expect(renderFn).toBeCalledTimes(1)
  })

  it('should re-render when the identity of the memoized object changes', () => {
    const { state, renderFn } = setup(true)
    act(() => {
      state.obj.b += 1
    })
    expect(renderFn).toBeCalledTimes(2)
  })
})

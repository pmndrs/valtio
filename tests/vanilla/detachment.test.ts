import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, subscribe, unstable_enableOp } from 'valtio'
import { subscribeKey } from 'valtio/utils'

afterEach(() => {
  unstable_enableOp(false)
})

describe('detachment dispatch', () => {
  it('deduplicates a subscriber reached by the mutation and a cycle', () => {
    unstable_enableOp()
    type State = { child: { parent?: State; count: number } }
    const raw: State = { child: { count: 1 } }
    raw.child.parent = raw
    const state = proxy(raw)
    const listener = vi.fn()
    const remove = subscribe(state, listener, true)
    state.child = { count: 2 }
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]![0]).toHaveLength(1)
    remove()
  })
})

describe('source-derived replacement fixtures', () => {
  it('selects a new raw chat without mutating the previously selected one', () => {
    const state = proxy<{
      opened: { id: string }[]
      current: { id: string } | null
    }>({ opened: [], current: null })
    const first = { id: 'old' }
    state.opened.push(first)
    state.current = first
    const next = { id: 'new' }
    state.opened.push(next)
    state.current = next
    expect(state.opened.map((item) => item.id)).toEqual(['old', 'new'])
    expect(state.current).toBe(state.opened[1])
  })

  it('preserves retained rows when assigning a sorted plain array', () => {
    const state = proxy({ items: [{ id: 'b' }] })
    const previous = state.items[0]
    state.items = [...state.items, { id: 'a' }].sort((a, b) =>
      a.id.localeCompare(b.id),
    )
    expect(snapshot(state).items).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(state.items[1]).toBe(previous)
  })

  it('notifies object-valued subscribeKey consumers on raw replacement', () => {
    const state = proxy({ plan: { exceeded: false } })
    let copied = false
    const remove = subscribeKey(
      state,
      'plan',
      (plan) => {
        copied = plan.exceeded
      },
      true,
    )
    state.plan = { exceeded: true }
    expect(copied).toBe(true)
    remove()
  })
})

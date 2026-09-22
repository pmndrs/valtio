import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  proxy,
  snapshot,
  subscribe,
  unstable_enableOp,
  unstable_getInternalStates,
} from 'valtio'
import { subscribeKey } from 'valtio/utils'

afterEach(() => {
  unstable_enableOp(false)
})

describe('detachment dispatch', () => {
  it('does not fabricate child mutation operations', () => {
    unstable_enableOp()
    const state = proxy({ child: { count: 1 } })
    const previous = state.child
    const rootListener = vi.fn()
    const childListener = vi.fn()
    const removeRoot = subscribe(state, rootListener, true)
    const removeChild = subscribe(previous, childListener, true)
    const next = { count: 2 }
    state.child = next
    expect(rootListener).toHaveBeenCalledExactlyOnceWith([
      ['set', ['child'], next, previous],
    ])
    expect(childListener).toHaveBeenCalledExactlyOnceWith([])
    expect(previous.count).toBe(1)
    removeRoot()
    removeChild()
  })

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

  it('does not call a listener removed earlier in detachment dispatch', () => {
    const state = proxy({ child: { nested: { count: 1 } } })
    const skipped = vi.fn()
    const removeA = subscribe(state.child, () => removeB(), true)
    const removeB = subscribe(state.child.nested, skipped, {
      keys: ['count'],
      sync: true,
    })
    state.child = { nested: { count: 2 } }
    expect(skipped).not.toHaveBeenCalled()
    removeA()
  })

  it('does not call a listener installed during the same dispatch', () => {
    const state = proxy({ child: { count: 1 } })
    const previous = state.child
    const added = vi.fn()
    let removeAdded = () => {}
    const remove = subscribe(
      previous,
      () => {
        removeAdded = subscribe(previous, added, {
          keys: ['count'],
          sync: true,
        })
      },
      true,
    )
    state.child = { count: 2 }
    expect(added).not.toHaveBeenCalled()
    remove()
    removeAdded()
  })

  it('keeps a reentrant replacement made by a synchronous subscriber', () => {
    const state = proxy({ child: { count: 1 } })
    const final = proxy({ count: 3 })
    const remove = subscribe(
      state.child,
      () => {
        state.child = final
      },
      true,
    )
    state.child = { count: 2 }
    expect(state.child).toBe(final)
    remove()
  })

  it('keeps key subscription setup independent of the subtree size', () => {
    const state = proxy({ child: { nested: { count: 1 } } })
    const { detachmentVersions } = unstable_getInternalStates()
    const set = vi.spyOn(detachmentVersions, 'set')
    const remove = subscribe(state, () => {}, { keys: ['child'], sync: true })
    expect(set).not.toHaveBeenCalled()
    remove()
    set.mockRestore()
  })

  it('visits each shared detached target once', () => {
    const shared = proxy({ count: 1 })
    const state = proxy({ child: { a: shared, b: shared } })
    const { detachmentVersions } = unstable_getInternalStates()
    const set = vi.spyOn(detachmentVersions, 'set')
    state.child = { a: { count: 2 }, b: { count: 3 } }
    expect(set).toHaveBeenCalledTimes(2)
    set.mockRestore()
  })

  it('preserves a nonwritable old child when replacement fails', () => {
    const state = proxy({ child: proxy({ count: 1 }) })
    const previous = state.child
    Object.defineProperty(state, 'child', { writable: false })
    const listener = vi.fn()
    const remove = subscribe(previous, listener, true)
    expect(Reflect.set(state, 'child', { count: 2 })).toBe(false)
    expect(state.child).toBe(previous)
    expect(listener).not.toHaveBeenCalled()
    previous.count = 2
    expect(listener).toHaveBeenCalledTimes(1)
    remove()
  })
})

describe('source-derived replacement fixtures', () => {
  it('distinguishes literal key subscriptions from subscribeKey getter compatibility', () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
    })
    const keyed = vi.fn()
    const derived = vi.fn()
    const removeKeyed = subscribe(state, keyed, {
      keys: ['doubled'],
      sync: true,
    })
    const removeDerived = subscribeKey(state, 'doubled', derived, true)
    state.count = 2
    expect(keyed).not.toHaveBeenCalled()
    expect(derived).toHaveBeenCalledExactlyOnceWith(4)
    removeKeyed()
    removeDerived()
  })
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

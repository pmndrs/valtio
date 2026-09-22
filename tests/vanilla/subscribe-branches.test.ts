import { describe, expect, it, vi } from 'vitest'
import { proxy, ref, subscribe, unstable_enableOp } from 'valtio'
import { subscribeKey } from 'valtio/utils'

describe('selected branch subscriptions', () => {
  it('observes a selected alias alongside a whole-store subscription', () => {
    const child = proxy({ count: 1 })
    const state = proxy({ a: child, b: child })
    const whole = vi.fn()
    const selected = vi.fn()
    const unsubscribeWhole = subscribe(state, whole, true)
    const unsubscribeSelected = subscribe(state, selected, {
      keys: ['b'],
      sync: true,
    })
    child.count++
    expect(whole).toHaveBeenCalledTimes(1)
    expect(selected).toHaveBeenCalledTimes(1)
    unsubscribeWhole()
    child.count++
    expect(whole).toHaveBeenCalledTimes(1)
    expect(selected).toHaveBeenCalledTimes(2)
    unsubscribeSelected()
  })

  it('observes descendants and replacements, excluding other branches', () => {
    const state = proxy({ obj: { nested: { count: 1 } }, other: { count: 0 } })
    const callback = vi.fn()
    const unsubscribe = subscribe(state, callback, {
      keys: ['obj'],
      sync: true,
    })
    state.other.count++
    expect(callback).not.toHaveBeenCalled()
    state.obj.nested.count++
    expect(callback).toHaveBeenCalledTimes(1)
    const previous = state.obj
    state.obj = { nested: { count: 3 } }
    expect(callback).toHaveBeenCalledTimes(2)
    previous.nested.count++
    expect(callback).toHaveBeenCalledTimes(2)
    state.obj.nested.count++
    expect(callback).toHaveBeenCalledTimes(3)
    unsubscribe()
    state.obj.nested.count++
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('keeps subscribeKey value filtering', () => {
    const state = proxy({ obj: { count: 1 } })
    const callback = vi.fn()
    const unsubscribe = subscribeKey(state, 'obj', callback, true)
    state.obj.count++
    expect(callback).not.toHaveBeenCalled()
    state.obj = { count: 3 }
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('deduplicates overlapping selected branches', () => {
    const child = proxy({ count: 1 })
    const state = proxy({ a: { child }, b: child })
    const callback = vi.fn()
    const unsubscribe = subscribe(state, callback, {
      keys: ['a', 'b'],
      sync: true,
    })
    child.count++
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('preserves nested operation paths', async () => {
    unstable_enableOp(true)
    try {
      const state = proxy({ obj: { nested: { count: 1 } } })
      const callback = vi.fn()
      const unsubscribe = subscribe(state, callback, { keys: ['obj'] })
      state.obj.nested.count = 2
      await Promise.resolve()
      expect(callback).toHaveBeenCalledWith([
        ['set', ['obj', 'nested', 'count'], 2, 1],
      ])
      unsubscribe()
    } finally {
      unstable_enableOp(false)
    }
  })

  it('does not traverse refs', () => {
    const child = ref(proxy({ count: 1 }))
    const state = proxy({ obj: child })
    const callback = vi.fn()
    const unsubscribe = subscribe(state, callback, {
      keys: ['obj'],
      sync: true,
    })
    child.count++
    expect(callback).not.toHaveBeenCalled()
    state.obj = ref(proxy({ count: 3 }))
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})

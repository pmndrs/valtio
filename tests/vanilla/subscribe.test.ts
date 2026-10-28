import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { batch, proxy, ref, subscribe } from 'valtio'

describe('subscribe', () => {
  const consoleWarn = console.warn

  beforeEach(() => {
    console.warn = vi.fn((message: string) => {
      if (message === 'Please use proxy object') {
        return
      }
      consoleWarn(message)
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    console.warn = consoleWarn
    vi.useRealTimers()
  })

  it('should call subscription', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(1)
  })

  it('should be able to unsubscribe', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    const unsubscribe = subscribe(obj, handler)
    unsubscribe()

    obj.count += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })

  it('should be able to unsubscribe from a subscriber', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    subscribe(obj, () => {
      unsubscribeB()
    })

    const unsubscribeB = subscribe(obj, handler)

    obj.count += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })

  it('should call subscription of object property', async () => {
    const obj = proxy({ nested: { count: 0 } })
    const handler = vi.fn()

    subscribe(obj.nested, handler)

    obj.nested.count += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(1)
  })

  it('should thow if subscribing to primitive property', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    expect(() => subscribe(obj.count as any, handler)).toThrow()
  })

  it('should not re-run subscription if no change', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count = 0

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })

  it('should not cause infinite loop', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn(() => {
      // Reset count if above 5
      if (obj.count > 5) {
        obj.count = 0
      }
    })

    subscribe(obj, handler)

    obj.count = 10

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(2)
    expect(obj.count).toBe(0)
  })

  it('should batch updates with batch()', () => {
    const obj = proxy({ count1: 0, count2: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    batch(() => {
      obj.count1 += 1
      obj.count2 += 1
    })

    expect(handler).toBeCalledTimes(1)
  })

  it('should not call subscription for objects wrapped in ref', async () => {
    const obj = proxy({ nested: ref({ count: 0 }) })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.nested.count += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })

  it('should not notify with assigning same object', async () => {
    const obj = {}
    const state = proxy({ obj })

    const handler = vi.fn()
    subscribe(state, handler)

    state.obj = obj
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })

  it('[DEV-ONLY] should warn when subscribing to a non-proxy object', () => {
    expect(() => subscribe({} as any, vi.fn())).toThrow()
    expect(console.warn).toHaveBeenCalledWith('Please use proxy object')
  })

  it('should notify synchronously', () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count += 1
    expect(handler).toBeCalledTimes(1)

    obj.count += 1
    expect(handler).toBeCalledTimes(2)
  })

  it('should call the callback without a receiver', () => {
    const obj = proxy({ count: 0 })
    const receivers: unknown[] = []

    subscribe(obj, function (this: unknown) {
      receivers.push(this)
    })

    obj.count += 1
    expect(receivers).toEqual([undefined])
  })

  it('should notify once per write without batch()', () => {
    const obj = proxy({ count1: 0, count2: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count1 += 1
    obj.count2 += 1

    expect(handler).toBeCalledTimes(2)
  })

  it('should not call a subscription unsubscribed inside a batch', () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    const unsubscribe = subscribe(obj, handler)
    batch(() => {
      obj.count += 1
      unsubscribe()
    })

    expect(handler).toBeCalledTimes(0)
  })
})

describe('subscribe across a replaced parent', () => {
  it('should keep hearing a child moved into a parent with reordered keys', () => {
    const state = proxy({ node: { child: { count: 0 }, other: 0 } })
    const child = state.node.child
    const handler = vi.fn()
    const unsubscribe = subscribe(state, handler)

    state.node.child.count = 1
    state.node = { other: 0, child }

    expect(state.node.child).toBe(child)
    expect(Object.keys(state.node)).toEqual(['other', 'child'])
    expect(handler).toHaveBeenCalledTimes(2)

    handler.mockClear()
    state.node.child.count = 2
    expect(handler).toHaveBeenCalledExactlyOnceWith()

    unsubscribe()
    handler.mockClear()
    state.node.child.count = 3
    expect(handler).not.toHaveBeenCalled()
  })

  it('should hear the new child after replacing a cyclic parent', () => {
    type Node = { child?: { count: number; parent: Node } }
    const node: Node = {}
    node.child = { count: 0, parent: node }
    const state = proxy({ node })
    const child = state.node.child!
    const handler = vi.fn()
    const unsubscribe = subscribe(state, handler)

    child.count = 1
    state.node = { child: { count: 1, parent: {} } }

    expect(state.node.child).not.toBe(child)
    expect(child.count).toBe(1)
    expect(handler).toHaveBeenCalledTimes(2)

    handler.mockClear()
    child.count = 2
    expect(handler).not.toHaveBeenCalled()
    state.node.child!.count = 2
    expect(handler).toHaveBeenCalledExactlyOnceWith()

    unsubscribe()
    handler.mockClear()
    state.node.child!.count = 3
    expect(handler).not.toHaveBeenCalled()
  })

  it('should notify once when a child is replaced by one with reordered keys', () => {
    const state = proxy({ node: { toString: 1, value: 2 } })
    const handler = vi.fn()

    subscribe(state, handler)
    state.node = { value: 2, toString: 1 }

    expect(handler).toHaveBeenCalledExactlyOnceWith()
  })
})

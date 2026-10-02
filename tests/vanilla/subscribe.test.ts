import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, ref, subscribe, unstable_enableOp } from 'valtio'

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

  it('should batch updates', async () => {
    const obj = proxy({ count1: 0, count2: 0 })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count1 += 1
    obj.count2 += 1

    await vi.advanceTimersByTimeAsync(0)
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

  it('should notify synchronously with the sync option', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    subscribe(obj, handler, true)

    obj.count += 1
    expect(handler).toBeCalledTimes(1)

    obj.count += 1
    expect(handler).toBeCalledTimes(2)
  })

  it('should not batch updates with the sync option', async () => {
    const obj = proxy({ count1: 0, count2: 0 })
    const handler = vi.fn()

    subscribe(obj, handler, true)

    obj.count1 += 1
    obj.count2 += 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(2)
  })

  it('should not call a subscription unsubscribed before the microtask runs', async () => {
    const obj = proxy({ count: 0 })
    const handler = vi.fn()

    const unsubscribe = subscribe(obj, handler)
    obj.count += 1
    unsubscribe()

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(0)
  })
})

describe('subscribe with op', () => {
  const consoleWarn = console.warn

  beforeEach(() => {
    unstable_enableOp(true)
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
    unstable_enableOp(false)
  })

  it('should notify ops', async () => {
    const obj = proxy<{ count1: number; count2?: number }>({
      count1: 0,
      count2: 0,
    })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.count1 += 1
    obj.count2 = 2

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(1)
    expect(handler).lastCalledWith([
      ['set', ['count1'], 1, 0],
      ['set', ['count2'], 2, 0],
    ])

    delete obj.count2

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(2)
    expect(handler).lastCalledWith([['delete', ['count2'], 2]])
  })

  it('should notify nested ops', async () => {
    const obj = proxy<{ nested: { count?: number } }>({
      nested: { count: 0 },
    })
    const handler = vi.fn()

    subscribe(obj, handler)

    obj.nested.count = 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(1)
    expect(handler).lastCalledWith([['set', ['nested', 'count'], 1, 0]])

    delete obj.nested.count

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(2)
    expect(handler).lastCalledWith([['delete', ['nested', 'count'], 1]])
  })

  it.each([false, true])(
    'should preserve queued child ops before replacing a parent with reordered keys (sync: %s)',
    async (sync) => {
      const state = proxy({ node: { child: { count: 0 }, other: 0 } })
      const previous = state.node
      const child = state.node.child
      const handler = vi.fn()
      const unsubscribe = subscribe(state, handler, sync)

      state.node.child.count = 1
      state.node = { other: 0, child }
      await vi.advanceTimersByTimeAsync(0)

      expect(state.node.child).toBe(child)
      expect(Object.keys(state.node)).toEqual(['other', 'child'])
      expect(handler.mock.calls.flatMap(([ops]) => ops)).toEqual([
        ['set', ['node', 'child', 'count'], 1, 0],
        ['set', ['node'], { other: 0, child }, previous],
      ])

      handler.mockClear()
      state.node.child.count = 2
      await vi.advanceTimersByTimeAsync(0)
      expect(handler).toHaveBeenCalledExactlyOnceWith([
        ['set', ['node', 'child', 'count'], 2, 1],
      ])

      unsubscribe()
      handler.mockClear()
      state.node.child.count = 3
      await vi.advanceTimersByTimeAsync(0)
      expect(handler).not.toHaveBeenCalled()
    },
  )

  it.each([false, true])(
    'should preserve queued child ops before replacing a cyclic parent (sync: %s)',
    async (sync) => {
      type Node = { child?: { count: number; parent: Node } }
      const node: Node = {}
      node.child = { count: 0, parent: node }
      const state = proxy({ node })
      const previous = state.node
      const child = state.node.child!
      const handler = vi.fn()
      const unsubscribe = subscribe(state, handler, sync)

      child.count = 1
      state.node = { child: { count: 1, parent: {} } }
      await vi.advanceTimersByTimeAsync(0)

      expect(state.node.child).not.toBe(child)
      expect(child.count).toBe(1)
      expect(handler.mock.calls.flatMap(([ops]) => ops)).toEqual([
        ['set', ['node', 'child', 'count'], 1, 0],
        ['set', ['node'], { child: { count: 1, parent: {} } }, previous],
      ])

      handler.mockClear()
      state.node.child!.count = 2
      await vi.advanceTimersByTimeAsync(0)
      expect(handler).toHaveBeenCalledExactlyOnceWith([
        ['set', ['node', 'child', 'count'], 2, 1],
      ])

      unsubscribe()
      handler.mockClear()
      state.node.child!.count = 3
      await vi.advanceTimersByTimeAsync(0)
      expect(handler).not.toHaveBeenCalled()
    },
  )

  it('should report replacement ops when assigned keys are reordered', () => {
    const state = proxy({ node: { toString: 1, value: 2 } })
    const handler = vi.fn()

    const previous = state.node
    subscribe(state, handler, true)
    state.node = { value: 2, toString: 1 }

    expect(handler.mock.calls.map(([ops]) => ops[0])).toEqual([
      ['set', ['node'], { value: 2, toString: 1 }, previous],
    ])
  })
})

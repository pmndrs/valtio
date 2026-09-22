import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  proxy,
  ref,
  snapshot,
  subscribe,
  unstable_enableOp,
  unstable_getInternalStates,
} from 'valtio'
import { applyChanges } from 'valtio/utils'

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

  it('should ignore a stale key unsubscribe', () => {
    const state = proxy({ count: 0 })
    const staleUnsubscribe = subscribe(state, () => {}, {
      keys: ['count'],
      sync: true,
    })
    staleUnsubscribe()
    const handler = vi.fn()
    const unsubscribe = subscribe(state, handler, {
      keys: ['count'],
      sync: true,
    })

    staleUnsubscribe()
    state.count += 1

    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe()
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

  it('should subscribe to selected branches', async () => {
    const state = proxy({ x: { y: 0 }, other: 0 })
    const handler = vi.fn()

    subscribe(state, handler, { keys: ['x'] })

    state.other += 1
    state.x.y += 1
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)

    state.x = { y: 1 }
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(2)

    state.x = proxy({ y: 2 })
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('should subscribe to multiple selected keys', async () => {
    const state = proxy({ x: 0, y: 0, other: 0 })
    const handler = vi.fn()

    subscribe(state, handler, { keys: ['x', 'y', 'x'] })

    state.x += 1
    state.y += 1
    state.other += 1
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should normalize numeric keys', async () => {
    const state = proxy([0, 0])
    const handler = vi.fn()

    subscribe(state, handler, { keys: [0] })

    state[1] = state[1]! + 1
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).not.toHaveBeenCalled()

    state[0] = state[0]! + 1
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should subscribe to symbol keys', () => {
    const key = Symbol()
    const state = proxy({ [key]: 0, other: 0 })
    const handler = vi.fn()

    subscribe(state, handler, { keys: [key], sync: true })

    state.other += 1
    expect(handler).not.toHaveBeenCalled()

    state[key] += 1
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should subscribe to array length', () => {
    const state = proxy([0, 1])
    const handler = vi.fn()

    subscribe(state, handler, { keys: ['length'], sync: true })

    state.length = 1
    expect(handler).toHaveBeenCalledTimes(1)

    state[2] = 2
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('should notify a multi-key subscriber once per mutation', () => {
    const state = proxy([0])
    const handler = vi.fn()

    subscribe(state, handler, { keys: [1, 'length'], sync: true })

    state[1] = 1
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should skip a key subscriber unsubscribed during combined dispatch', () => {
    const state = proxy([0])
    const handler = vi.fn()
    let unsubscribe = () => {}

    subscribe(
      state,
      () => {
        unsubscribe()
      },
      { keys: [1], sync: true },
    )
    unsubscribe = subscribe(state, handler, {
      keys: ['length'],
      sync: true,
    })

    state[1] = 1
    expect(handler).not.toHaveBeenCalled()
  })

  it('should keep the baseline of an existing key registration', () => {
    const state = proxy({ node: { trigger: 0, a: 0, b: 0 } })
    const proxyState = unstable_getInternalStates().proxyStateMap.get(
      state.node,
    ) as any
    const listener = vi.fn()
    const removeA = proxyState[3]('a', listener)
    let removeB = () => {}
    const removeTrigger = subscribe(
      state.node,
      () => {
        removeB = proxyState[3]('b', listener)
      },
      { keys: ['trigger'], sync: true },
    )

    state.node = { trigger: 1, a: 1, b: 0 }
    removeA()
    removeB()
    removeTrigger()

    expect(listener).toHaveBeenCalledTimes(1)
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

  it('should notify selected keys synchronously', () => {
    const state = proxy({ x: 0, y: 0 })
    const handler = vi.fn()

    subscribe(state, handler, { keys: ['x'], sync: true })

    state.y += 1
    expect(handler).not.toHaveBeenCalled()

    state.x += 1
    expect(handler).toHaveBeenCalledTimes(1)
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

    obj.nested = { count: 2 }

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toBeCalledTimes(3)
    expect(handler).lastCalledWith([['set', ['nested'], { count: 2 }, {}]])
  })

  it('should preserve nested op order during applyChanges', () => {
    const state = proxy({ node: { child: { count: 0 }, sibling: 0 } })
    const handler = vi.fn()
    const unsubscribe = subscribe(state.node, handler, { sync: true })

    applyChanges(state.node, { child: { count: 1 }, sibling: 1 })
    unsubscribe()

    expect(handler.mock.calls.flatMap(([ops]) => ops)).toEqual([
      ['set', ['child', 'count'], 1, 0],
      ['set', ['sibling'], 1, 0],
    ])
  })

  it('should preserve queued ops after reading a snapshot', () => {
    const state = proxy({ node: { child: { count: 0 }, sibling: 0 } })
    const received: unknown[] = []
    const unsubscribe = subscribe(
      state,
      (ops) => {
        received.push(...ops)
        snapshot(state)
      },
      { sync: true },
    )

    applyChanges(state.node, { child: { count: 1 }, sibling: 1 })
    unsubscribe()

    expect(received).toEqual([
      ['set', ['node', 'child', 'count'], 1, 0],
      ['set', ['node', 'sibling'], 1, 0],
    ])
  })

  it('should preserve reentrant op order during applyChanges', () => {
    const state = proxy({ node: { child: { count: 0 }, sibling: 0 } })
    const handler = vi.fn()
    const unsubscribeChild = subscribe(
      state.node.child,
      () => {
        state.node.sibling = 2
      },
      { sync: true },
    )
    const unsubscribeNode = subscribe(state.node, handler, { sync: true })

    applyChanges(state.node, { child: { count: 1 }, sibling: 1 })
    unsubscribeChild()
    unsubscribeNode()

    expect(handler.mock.calls.flatMap(([ops]) => ops)).toEqual([
      ['set', ['child', 'count'], 1, 0],
      ['set', ['sibling'], 2, 0],
      ['set', ['sibling'], 1, 2],
    ])
    expect(state.node.sibling).toBe(1)
  })

  it('should preserve raw values in applyChanges ops', () => {
    const state = proxy<{ node: { child?: { count: number } } }>({ node: {} })
    const raw = { count: 1 }
    const handler = vi.fn()
    const unsubscribe = subscribe(state.node, handler, { sync: true })

    applyChanges(state.node, { child: raw })
    unsubscribe()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0][0]![2]).toBe(raw)
  })

  it('should invalidate selected keys in a detached cyclic graph', () => {
    type Node = { a?: Node; b?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const next: Node = {}
    next.a = next
    next.b = {}
    const state = proxy({ node: current })
    const handler = vi.fn()
    const unsubscribe = subscribe(state.node, handler, {
      keys: ['a'],
      sync: true,
    })

    state.node = next
    unsubscribe()

    expect(handler).toHaveBeenCalledExactlyOnceWith([])
  })

  it('should notify a reentrant key change after a retained key', () => {
    type Node = { a?: Node; b?: Node; c: number }
    const current: Node = { c: 0 }
    current.a = current
    current.b = current
    const next: Node = { b: { c: 0 }, c: 1 }
    next.a = next
    const state = proxy({ node: current })
    const replacement = proxy<Node>({ c: 2 })
    const handler = vi.fn()
    const unsubscribeA = subscribe(state.node, handler, {
      keys: ['a'],
      sync: true,
    })
    const unsubscribeC = subscribe(
      state.node,
      () => {
        state.node.a = replacement
      },
      { keys: ['c'], sync: true },
    )

    state.node = next
    unsubscribeA()
    unsubscribeC()

    expect(state.node.a).toBe(replacement)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should notify when replacement reveals an inherited value', () => {
    const state = proxy({
      node: { toString: Object.prototype.toString },
    })
    const handler = vi.fn()
    const unsubscribe = subscribe(state.node, handler, {
      keys: ['toString'],
      sync: true,
    })

    state.node = {} as { toString: typeof Object.prototype.toString }
    unsubscribe()

    expect(Object.hasOwn(state.node, 'toString')).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should not send queued ops to a late subscriber', () => {
    const state = proxy({ node: { child: { count: 0 }, sibling: 0 } })
    const received: unknown[] = []
    const keepSubscribed = subscribe(state.node, () => {}, { sync: true })
    let unsubscribeLate = () => {}
    const unsubscribeChild = subscribe(
      state.node.child,
      () => {
        unsubscribeLate = subscribe(
          state.node,
          (ops) => received.push(...ops),
          { sync: true },
        )
      },
      { sync: true },
    )

    state.node = { child: { count: 1 }, sibling: 1 }
    keepSubscribed()
    unsubscribeChild()
    unsubscribeLate()

    expect(received).toEqual([])
  })

  it('should not send reordered queued ops to a late subscriber', () => {
    const state = proxy({ node: { child: { count: 0 }, sibling: 0 } })
    const received: unknown[] = []
    const keepSubscribed = subscribe(state, () => {}, { sync: true })
    let unsubscribeLate = () => {}
    const unsubscribeChild = subscribe(
      state.node.child,
      () => {
        unsubscribeLate = subscribe(state, (ops) => received.push(...ops), {
          sync: true,
        })
      },
      { sync: true },
    )

    state.node = { sibling: 1, child: { count: 1 } }
    keepSubscribed()
    unsubscribeChild()
    unsubscribeLate()

    expect(received).toEqual([])
  })

  it('should only notify ops for selected keys', async () => {
    const state = proxy({ x: 0, y: 0 })
    const handler = vi.fn()

    subscribe(state, handler, { keys: ['x'] })

    state.x = 1
    state.y = 1

    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).lastCalledWith([['set', ['x'], 1, 0]])
  })

  it('should not duplicate ops for selected keys', async () => {
    const state = proxy([0])
    const handler = vi.fn()

    subscribe(state, handler, { keys: [1, 'length'] })

    state[1] = 1
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).lastCalledWith([['set', ['1'], 1, undefined]])
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

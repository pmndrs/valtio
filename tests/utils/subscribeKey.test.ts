import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  batch,
  proxy,
  snapshot,
  subscribe,
  unstable_getInternalStates,
} from 'valtio'
import { subscribeKey } from 'valtio/utils'

describe('subscribeKey', () => {
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
    const obj = proxy({ count1: 0, count2: 0 })
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    subscribeKey(obj, 'count1', handler1)
    subscribeKey(obj, 'count2', handler2)

    obj.count1 += 10

    await vi.advanceTimersByTimeAsync(0)
    expect(handler1).toBeCalledTimes(1)
    expect(handler1).lastCalledWith(10)
    expect(handler2).toBeCalledTimes(0)

    obj.count2 += 20

    await vi.advanceTimersByTimeAsync(0)
    expect(handler1).toBeCalledTimes(1)
    expect(handler2).toBeCalledTimes(1)
    expect(handler2).lastCalledWith(20)
  })

  it('snapshot changed if subscription after delete nested property', async () => {
    const obj = proxy({ s: { a: 1 } } as any)
    const snapshot1 = snapshot(obj)
    delete obj.s.a
    subscribe(obj, () => {})
    const snapshot2 = snapshot(obj)
    expect(snapshot1).not.toEqual(snapshot2)
  })

  it('should preserve the final Object.is comparison', async () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()

    subscribeKey(state, 'count', handler)
    batch(() => {
      state.count = 1
      state.count = 0
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it.each([
    [
      'own',
      (): { count: number; readonly doubled: number } =>
        proxy({
          count: 1,
          get doubled() {
            return this.count * 2
          },
        }),
    ],
    [
      'inherited',
      (): { count: number; readonly doubled: number } =>
        proxy(
          new (class {
            count = 1
            get doubled() {
              return this.count * 2
            }
          })(),
        ),
    ],
  ] as const)('should notify for an %s getter', (_name, createState) => {
    const state = createState()
    const handler = vi.fn()

    const unsubscribe = subscribeKey(state, 'doubled', handler)
    state.count = 2

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenLastCalledWith(4)
    unsubscribe()
  })

  it('should notify when deleting a property reveals a getter', () => {
    class State {
      count = 1
      get selected() {
        return this.count
      }
    }
    const state = proxy(new State())
    Object.defineProperty(state, 'selected', {
      value: 1,
      configurable: true,
    })
    const handler = vi.fn()

    subscribeKey(state, 'selected', handler)
    delete (state as { selected?: number }).selected
    state.count = 2

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenLastCalledWith(2)
  })

  it('should only notify for an object key when its proxy is replaced', async () => {
    const state = proxy({ nested: { count: 0 } })
    const nested = state.nested
    const handler = vi.fn()

    subscribeKey(state, 'nested', handler)
    state.nested.count = 1
    await vi.advanceTimersByTimeAsync(0)
    expect(state.nested).toBe(nested)
    expect(handler).not.toHaveBeenCalled()

    const nextNested = proxy({ count: 2 })
    state.nested = nextNested
    await vi.advanceTimersByTimeAsync(0)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenLastCalledWith(nextNested)
  })

  it('should run in the round that delivers the write to its key', () => {
    const state = proxy({ a: 0, b: 0 })
    const seen: string[] = []
    subscribeKey(state, 'a', () => {
      seen.push('a')
      state.b = 1
    })
    subscribeKey(state, 'b', () => seen.push('b'))
    subscribe(state, () => seen.push('state'))

    state.a = 1

    // every subscriber hears a before anything hears b
    expect(seen).toEqual(['a', 'state', 'b', 'state'])
  })

  it('should take an array index as a number', () => {
    const state = proxy([0, 1])
    const handler = vi.fn()

    subscribeKey(state, 0, handler)
    state[1] = 2
    state[0] = 3

    expect(handler).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('should not link the subtree under its key', () => {
    const state = proxy({ nested: { count: 0 } })
    const { proxyStateMap } = unstable_getInternalStates()

    subscribeKey(state, 'nested', () => {})

    expect(proxyStateMap.get(state.nested)![3].size).toBe(0)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, subscribe } from 'valtio'
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
})

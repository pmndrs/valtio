import { describe, expect, it, vi } from 'vitest'
import { batch, proxy, snapshot, subscribe } from 'valtio'
import { subscribeKey } from 'valtio/utils'

describe('batch', () => {
  it('should return the result of fn', () => {
    expect(batch(() => 42)).toBe(42)
  })

  it('should notify once after the outermost batch returns', () => {
    const state = proxy({ a: 0, b: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    batch(() => {
      state.a = 1
      batch(() => {
        state.b = 1
      })
      expect(handler).not.toHaveBeenCalled()
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should make writes visible to reads and snapshot inside the batch', () => {
    const state = proxy({ count: 0 })
    batch(() => {
      state.count = 1
      expect(state.count).toBe(1)
      expect(snapshot(state).count).toBe(1)
    })
  })

  it('should call back once, with no arguments', () => {
    const state = proxy({ a: 0, b: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    batch(() => {
      state.a = 1
      state.b = 1
      state.a = 2
    })

    expect(handler).toHaveBeenCalledExactlyOnceWith()
  })
})

describe('delivery order', () => {
  it.each([
    ['a batched write', (fn: () => void) => batch(fn)],
    ['an unbatched write', (fn: () => void) => fn()],
  ])(
    'should not let a write made by a callback overtake earlier writes (%s)',
    (_, run) => {
      const state = proxy({ a: 0, b: 0 })
      subscribe(
        state,
        () => {
          state.b = 1
        },
        { keys: ['a'] },
      )
      const seen: string[] = []
      subscribe(state, () => seen.push('a'), { keys: ['a'] })
      subscribe(state, () => seen.push('b'), { keys: ['b'] })

      run(() => {
        state.a = 1
      })

      expect(seen).toEqual(['a', 'b'])
    },
  )

  it('should deliver the writes made by a callback together in the next round', () => {
    const state = proxy({ a: 0, b: 0, c: 0 })
    subscribe(
      state,
      () => {
        state.b = 1
        state.c = 1
      },
      { keys: ['a'] },
    )
    const seen: string[] = []
    subscribe(state, () => seen.push('a'), { keys: ['a'] })
    subscribe(state, () => seen.push('b or c'), { keys: ['b', 'c'] })

    state.a = 1

    expect(seen).toEqual(['a', 'b or c'])
  })

  it('should return from a batch called in a callback before its listeners run', () => {
    const state = proxy({ a: 0, b: 0 })
    const seen: string[] = []
    let seenWhenInnerBatchReturned: string[] | undefined
    subscribe(
      state,
      () => {
        batch(() => {
          state.b = 1
        })
        seenWhenInnerBatchReturned = [...seen]
      },
      { keys: ['a'] },
    )
    subscribe(state, () => seen.push('a'), { keys: ['a'] })
    subscribe(state, () => seen.push('b'), { keys: ['b'] })

    state.a = 1

    expect(seenWhenInnerBatchReturned).toEqual([])
    expect(seen).toEqual(['a', 'b'])
  })

  it('should skip a subscription removed before its round runs', () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    let unsubscribe: () => void = () => {}
    subscribe(state, () => {
      unsubscribe()
    })
    unsubscribe = subscribe(state, handler)

    state.count = 1

    expect(handler).not.toHaveBeenCalled()
  })

  it('should notify once per internal write of native array methods without batch', () => {
    const state = proxy([0, 1, 2, 3])
    const handler = vi.fn()
    subscribe(state, handler)

    state.splice(1, 2)

    expect(handler.mock.calls.length).toBeGreaterThan(1)
  })
})

// Runs write and returns the errors it rethrew in microtasks,
// instead of letting them escape as uncaught errors.
const reportedErrors = (write: () => void) => {
  const callbacks: (() => void)[] = []
  const spy = vi
    .spyOn(globalThis, 'queueMicrotask')
    .mockImplementation((callback) => {
      callbacks.push(callback)
    })
  try {
    write()
  } finally {
    spy.mockRestore()
  }
  return callbacks.map((callback) => {
    try {
      callback()
    } catch (error) {
      return error
    }
    return undefined
  })
}

describe('errors', () => {
  it('should run the other subscribers and rethrow each error in a microtask without batch', () => {
    const state = proxy({ count: 0 })
    const error1 = new Error('first')
    const error2 = new Error('second')
    const handler = vi.fn()
    subscribe(state, () => {
      throw error1
    })
    subscribe(state, handler)
    subscribe(state, () => {
      throw error2
    })

    const errors = reportedErrors(() => {
      state.count = 1
    })

    expect(state.count).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(errors).toEqual([error1, error2])
  })

  it('should complete a native array method when a subscriber throws', () => {
    const state = proxy([0, 1, 2, 3])
    const error = new Error('boom')
    subscribe(state, () => {
      throw error
    })

    const errors = reportedErrors(() => {
      state.splice(1, 2)
    })

    expect(state).toEqual([0, 3])
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.every((e) => e === error)).toBe(true)
  })

  it('should run the other subscribers and throw an AggregateError from batch', () => {
    const state = proxy({ count: 0 })
    const error1 = new Error('first')
    const error2 = new Error('second')
    const handler = vi.fn()
    subscribe(state, () => {
      throw error1
    })
    subscribe(state, handler)
    subscribe(state, () => {
      throw error2
    })

    let thrown: unknown
    try {
      batch(() => {
        state.count = 1
      })
    } catch (e) {
      thrown = e
    }

    expect(state.count).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([error1, error2])
  })

  it('should rethrow an error from fn unchanged after delivering its writes', () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    subscribe(state, handler)
    const error = new Error('fn')

    expect(() =>
      batch(() => {
        state.count = 1
        throw error
      }),
    ).toThrow(error)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should list the error from fn first when a callback also throws', () => {
    const state = proxy({ count: 0 })
    const fnError = new Error('fn')
    const callbackError = new Error('callback')
    const handler = vi.fn()
    subscribe(state, () => {
      throw callbackError
    })
    subscribe(state, handler)

    let thrown: unknown
    try {
      batch(() => {
        state.count = 1
        throw fnError
      })
    } catch (e) {
      thrown = e
    }

    expect(handler).toHaveBeenCalledTimes(1)
    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([fnError, callbackError])
  })
})

describe('errors from a batch inside a callback', () => {
  const setup = () => {
    const state = proxy({ a: 0, b: 0 })
    const fnError = new Error('fn')
    const bHandler = vi.fn()
    subscribe(state, () => {
      if (state.b === 0) {
        batch(() => {
          state.b = 1
          throw fnError
        })
      }
    })
    subscribe(state, bHandler)
    return { state, fnError, bHandler }
  }

  it('should deliver its writes and rethrow its error in a microtask when the outer write is not batched', () => {
    const { state, fnError, bHandler } = setup()

    const errors = reportedErrors(() => {
      state.a = 1
    })

    expect(state.b).toBe(1)
    expect(bHandler).toHaveBeenCalledTimes(2)
    expect(errors).toEqual([fnError])
  })

  it('should deliver its writes and throw its error from the outer batch', () => {
    const { state, fnError, bHandler } = setup()

    let thrown: unknown
    try {
      batch(() => {
        state.a = 1
      })
    } catch (e) {
      thrown = e
    }

    expect(state.b).toBe(1)
    expect(bHandler).toHaveBeenCalledTimes(2)
    expect(thrown).toBeInstanceOf(AggregateError)
    expect((thrown as AggregateError).errors).toEqual([fnError])
  })
})

describe('coalescing recipe from the subscribe docs', () => {
  // Keep in sync with docs/api/advanced/subscribe.mdx
  const subscribeCoalesced = (proxyObject: object, callback: () => void) => {
    let scheduled = false
    let active = true
    const unsubscribe = subscribe(proxyObject, () => {
      if (!scheduled) {
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          if (active) callback()
        })
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }

  it('should call back once per burst', async () => {
    const state = proxy({ a: 0, b: 0 })
    const handler = vi.fn()
    subscribeCoalesced(state, handler)

    state.a = 1
    state.b = 1
    expect(handler).not.toHaveBeenCalled()

    await Promise.resolve()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('should not call back after unsubscribing', async () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    const unsubscribe = subscribeCoalesced(state, handler)

    state.count = 1
    unsubscribe()

    await Promise.resolve()
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('removed arguments', () => {
  const message =
    'notifyInSync has been removed. subscribe() is synchronous. Use batch() to group notifications.'

  it.each([true, false])('should throw for subscribe(p, cb, %s)', (value) => {
    const state = proxy({ count: 0 })
    expect(() => (subscribe as any)(state, () => {}, value)).toThrow(message)
  })

  it('should accept an explicit undefined third argument', () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    ;(subscribe as any)(state, handler, undefined)
    state.count = 1
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should reject a callback that takes ops, as a type error', () => {
    const state = proxy({ count: 0 })
    const callback = vi.fn((ops: unknown[]) => ops)
    // @ts-expect-error the callback is called with no arguments
    subscribe(state, callback)
    state.count = 1
    expect(callback).toHaveBeenCalledExactlyOnceWith()
  })

  it('should throw for a boolean fourth argument of subscribeKey', () => {
    const state = proxy({ count: 0 })
    expect(() => (subscribeKey as any)(state, 'count', () => {}, true)).toThrow(
      'notifyInSync has been removed. subscribeKey() is synchronous. Use batch() to group notifications.',
    )
  })
})

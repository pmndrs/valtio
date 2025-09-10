import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { watch } from 'valtio/utils'
import { sleep } from './utils'

describe('watch', () => {
  beforeEach(() => {
    // don't fake setImmediate, it conflict with javascript debugger and cause stuck
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'Date',
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should re-run for individual proxy updates', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    watch((get) => {
      get(reference)
      callback()
    })

    expect(callback).toBeCalledTimes(1)

    reference.value = 'Update'
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(2)
  })

  it('should re-run for multiple proxy updates', async () => {
    const A = proxy({ value: 'A' })
    const B = proxy({ value: 'B' })

    const callback = vi.fn()

    watch((get) => {
      get(A)
      get(B)
      callback()
    })

    expect(callback).toBeCalledTimes(1)

    A.value = 'B'
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(2)

    B.value = 'C'
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(3)
  })

  it('should cleanup when state updates', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    watch((get) => {
      get(reference)

      return () => {
        callback()
      }
    })

    expect(callback).toBeCalledTimes(0)

    reference.value = 'Update'
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(1)
  })

  it('should cleanup when stopped', () => {
    const callback = vi.fn()

    const stop = watch(() => callback)

    expect(callback).toBeCalledTimes(0)

    stop()

    expect(callback).toBeCalledTimes(1)
  })

  it('should cleanup internal effects when stopped', () => {
    const callback = vi.fn()

    const stop = watch(() => {
      watch(() => {
        watch(() => {
          watch(() => {
            watch(() => () => {
              callback()
            })
          })
        })
      })
    })

    expect(callback).toBeCalledTimes(0)

    stop()

    expect(callback).toBeCalledTimes(1)
  })

  it('should not loop infinitely with sync (#382)', () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    watch(
      (get) => {
        get(reference)
        callback()
      },
      { sync: true },
    )

    expect(callback).toBeCalledTimes(1)

    reference.value = 'Update'
    expect(callback).toBeCalledTimes(2)
    expect(reference.value).toBe('Update')
  })

  it('should support promise watchers', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    watch(async (get) => {
      await sleep(10000)
      get(reference)
      callback()
    })

    await vi.advanceTimersByTimeAsync(10000)
    expect(callback).toBeCalledTimes(1)

    reference.value = 'Update'
    await vi.advanceTimersByTimeAsync(10000)
    expect(callback).toBeCalledTimes(2)
  })

  it('should not subscribe if the watch is stopped before the promise completes', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    const stop = watch(async (get) => {
      await sleep(10000)
      get(reference)
      callback()
    })
    stop()

    await vi.advanceTimersByTimeAsync(10000)
    expect(callback).toBeCalledTimes(1)

    reference.value = 'Update'
    await vi.advanceTimersByTimeAsync(10000)
    expect(callback).toBeCalledTimes(1)
  })
})

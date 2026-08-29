import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { watch } from 'valtio/utils'
import { sleep } from '../test-utils.js'

describe('watch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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

  it('should unsubscribe proxies that are no longer tracked', async () => {
    const flag = proxy({ on: true })
    const a = proxy({ value: 0 })
    const b = proxy({ value: 0 })

    const callback = vi.fn()

    watch((get) => {
      if (get(flag).on) get(a)
      else get(b)
      callback()
    })

    expect(callback).toBeCalledTimes(1)

    flag.on = false
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(2)

    a.value = 1
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(2)

    b.value = 1
    await vi.advanceTimersByTimeAsync(0)
    expect(callback).toBeCalledTimes(3)
  })

  it('should ignore a revalidation triggered by its own cleanup', () => {
    const reference = proxy({ value: 0 })

    const callback = vi.fn()

    const stop = watch(
      (get) => {
        get(reference)
        callback()
        return () => {
          reference.value += 1
        }
      },
      { sync: true },
    )

    expect(callback).toBeCalledTimes(1)

    stop()

    expect(callback).toBeCalledTimes(1)
  })

  // The cleanup returned by an async callback is dropped when the watch was
  // already stopped, so it never runs.
  it('should drop a cleanup returned after the watch is stopped', async () => {
    const cleanup = vi.fn()

    const stop = watch(async () => {
      await sleep(1000)
      return cleanup
    })
    stop()

    await vi.advanceTimersByTimeAsync(2000)
    expect(cleanup).toBeCalledTimes(0)
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

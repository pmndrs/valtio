import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { watch } from 'valtio/utils'

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

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
    await Promise.resolve()
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
    await Promise.resolve()
    expect(callback).toBeCalledTimes(2)
    B.value = 'C'
    await Promise.resolve()
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
    await Promise.resolve()
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

    watch(
      (get) => {
        get(reference)
      },
      { sync: true },
    )

    reference.value = 'Update'
  })
  it('should support promise watchers', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    const waitPromise = sleep(10000)
    watch(async (get) => {
      await waitPromise
      get(reference)
      callback()
    })

    vi.runAllTimers()
    await waitPromise

    expect(callback).toBeCalledTimes(1)
    // listener will only be attached after one promise callback due to the await stack
    await Promise.resolve()
    reference.value = 'Update'
    // wait for internal promise
    await Promise.resolve()
    // wait for next promise resolve call due to promise usage inside of callback
    await Promise.resolve()
    expect(callback).toBeCalledTimes(2)
  })

  it('should not subscribe if the watch is stopped before the promise completes', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = vi.fn()

    const waitPromise = sleep(10000)
    const stop = watch(async (get) => {
      await waitPromise
      get(reference)
      callback()
    })
    stop()

    vi.runAllTimers()
    await waitPromise

    expect(callback).toBeCalledTimes(1)
    // listener will only be attached after one promise callback due to the await stack
    await Promise.resolve()
    reference.value = 'Update'
    // wait for internal promise
    await Promise.resolve()
    // wait for next promise resolve call due to promise usage inside of callback
    await Promise.resolve()
    expect(callback).toBeCalledTimes(1)
  })
})

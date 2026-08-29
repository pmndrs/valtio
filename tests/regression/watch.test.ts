import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { watch } from 'valtio/utils'
import { sleep } from '../test-utils.js'

describe('regression (watch)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('should not capture unrelated watches created while an async watch is pending (#1183)', async () => {
    const A = proxy({ value: 0 })
    const B = proxy({ value: 0 })

    const cbA = vi.fn()
    const cbB = vi.fn()

    // watch1 is async and suspends at its await. While it is suspended, the
    // shared watch context must not leak watch1's cleanups set.
    watch(async (get) => {
      get(A)
      await sleep(1000)
      cbA()
    })

    // While watch1 is suspended, create an independent watch2. Its cleanup
    // must not be attached to watch1.
    await vi.advanceTimersByTimeAsync(500)
    watch((get) => {
      get(B)
      cbB()
    })
    expect(cbB).toBeCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    expect(cbA).toBeCalledTimes(1)

    // Trigger watch1 to revalidate, which runs its own cleanups. If watch2's
    // cleanup had leaked into watch1, this would unsubscribe watch2.
    A.value = 1
    await vi.advanceTimersByTimeAsync(2000)

    // watch2 must still react to B updates.
    cbB.mockClear()
    B.value = 1
    await vi.advanceTimersByTimeAsync(0)
    expect(cbB).toBeCalledTimes(1)
  })
})

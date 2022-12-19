import { watch } from 'valtio/utils'
import { reaction } from 'valtio/utils/watch'
import { proxy } from 'valtio/vanilla'

describe('watch', () => {
  it('should re-run for individual proxy updates', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = jest.fn()

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

    const callback = jest.fn()

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

    const callback = jest.fn()

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
    const callback = jest.fn()

    const stop = watch(() => callback)

    expect(callback).toBeCalledTimes(0)
    stop()
    expect(callback).toBeCalledTimes(1)
  })
  it('should cleanup internal effects when stopped', () => {
    const callback = jest.fn()

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
      { sync: true }
    )

    reference.value = 'Update'
  })
})

describe('reaction', () => {
  it('should re-run for individual proxy updates', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = jest.fn()

    const r = reaction(callback)
    r.track(() => {
      reference.value // read a value in the proxy
    })

    expect(callback).toBeCalledTimes(0)
    reference.value = 'Update'
    await Promise.resolve()
    expect(callback).toBeCalledTimes(1)
  })

  it('should re-run for multiple proxy updates', async () => {
    const A = proxy({ value: 'A' })
    const B = proxy({ value: 'B' })

    const callback = jest.fn()

    const r = reaction(callback)
    r.track(() => {
      A.value
      B.value
    })

    expect(callback).toBeCalledTimes(0)
    A.value = 'B'
    await Promise.resolve()
    expect(callback).toBeCalledTimes(1)
    B.value = 'C'
    await Promise.resolve()
    expect(callback).toBeCalledTimes(2)
  })
  it('should cleanup when track called', async () => {
    const reference = proxy({ value: 'Example' })

    const callback = jest.fn()
    const cleanupCallback = jest.fn()
    const cleanupCallback2 = jest.fn()

    const r = reaction(callback)

    r.track(() => {
      reference.value
      return () => {
        cleanupCallback()
      }
    })

    expect(callback).toBeCalledTimes(0)
    expect(cleanupCallback).toBeCalledTimes(0)
    reference.value = 'Update'
    await Promise.resolve()
    expect(callback).toBeCalledTimes(1)
    expect(cleanupCallback).toBeCalledTimes(0)
    // re-evaluate the tracking function
    r.track(() => {
      reference.value
      return () => {
        cleanupCallback2()
      }
    })
    // old cleanup should have been called, new cleanup
    // has not yet been called, and effect has not updated
    await Promise.resolve()
    expect(callback).toBeCalledTimes(1)
    expect(cleanupCallback).toBeCalledTimes(1)
    expect(cleanupCallback2).toBeCalledTimes(0)
    // dispose of the reaction and observe new cleanup is called
    r.dispose()
    expect(callback).toBeCalledTimes(1)
    expect(cleanupCallback).toBeCalledTimes(1)
    expect(cleanupCallback2).toBeCalledTimes(1)
  })

  it('should cleanup when stopped', () => {
    const reference = proxy({ value: 'Example' })
    const callback = jest.fn()

    const cleanupCallback = jest.fn()

    const r = reaction(callback)

    r.track(() => {
      reference.value
      return () => {
        cleanupCallback()
      }
    })

    expect(callback).toBeCalledTimes(0)
    expect(cleanupCallback).toBeCalledTimes(0)
    r.dispose()
    expect(callback).toBeCalledTimes(0)
    expect(cleanupCallback).toBeCalledTimes(1)
  })

  it('should cleanup internal effects when stopped', () => {
    const reference = proxy({ value: 'Example', other: 'Value' })
    const callback = jest.fn()
    const callback2 = jest.fn()
    const cleanupCallback = jest.fn()

    const r = reaction(callback)
    r.track(() => {
      const r2 = reaction(callback2)
      reference.value
      r2.track(() => {
        reference.other
        return () => {
          cleanupCallback()
        }
      })
      return r2.dispose
    })
    expect(callback).toBeCalledTimes(0)
    expect(callback2).toBeCalledTimes(0)
    r.dispose()
    expect(cleanupCallback).toBeCalledTimes(1)
  })

  it('should not loop infinitely with sync (#382)', () => {
    const reference = proxy({ value: 'Example' })
    const callback = jest.fn()

    const r = reaction(callback, { sync: true })
    r.track(() => {
      reference.value
    })

    reference.value = 'Update'
  })
})

import { watch } from 'valtio/utils'
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
})

import { proxy, subscribe } from '../src/index'

describe('subscribe', () => {
  it('should call subscription', () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count += 1

    expect(handler).toBeCalledTimes(1)
  })

  it('should be able to unsubscribe', () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    const unsubscribe = subscribe(obj, handler)
    unsubscribe()

    obj.count += 1

    expect(handler).toBeCalledTimes(0)
  })

  it.skip('should call subscription of property', () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    subscribe(obj.count, handler)

    obj.count += 1

    expect(handler).toBeCalledTimes(1)
  })

  it('should call subscription of nested property', () => {
    const obj = proxy({ nested: { count: 0 } })
    const handler = jest.fn()

    subscribe(obj.nested, handler)

    obj.nested.count += 1

    expect(handler).toBeCalledTimes(1)
  })

  it.skip('should not re-run subscription if no change', () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count = 0

    expect(handler).toBeCalledTimes(0)
  })

  it('should not cause infinite loop', () => {
    const obj = proxy({ count: 0 })
    const handler = () => {
      // Reset count if above 5
      if (obj.count > 5) {
        obj.count = 0
      }
    }

    subscribe(obj, handler)

    obj.count = 10
  })

  it.skip('should not cause infinite loop with increment', () => {
    const obj = proxy({ count: 0 })
    const handler = () => {
      obj.count += 1
    }

    subscribe(obj, handler)

    obj.count += 1
  })
})

import { proxy, ref, subscribe } from '../src/index'

describe('subscribe', () => {
  it('should call subscription', async () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count += 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should be able to unsubscribe', async () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    const unsubscribe = subscribe(obj, handler)
    unsubscribe()

    obj.count += 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(0)
  })

  it('should call subscription of object property', async () => {
    const obj = proxy({ nested: { count: 0 } })
    const handler = jest.fn()

    subscribe(obj.nested, handler)

    obj.nested.count += 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should thow if subscribing to primitive property', async () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    expect(() => subscribe(obj.count, handler)).toThrow()
  })

  it('should not re-run subscription if no change', async () => {
    const obj = proxy({ count: 0 })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count = 0

    await Promise.resolve()
    expect(handler).toBeCalledTimes(0)
  })

  it('should not cause infinite loop', async () => {
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

  it('should batch updates', async () => {
    const obj = proxy({ count1: 0, count2: 0 })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count1 += 1
    obj.count2 += 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should not call subscription for objects wrapped in ref', async () => {
    const obj = proxy({ nested: ref({ count: 0 }) })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.nested.count += 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(0)
  })

  it('should notify ops', async () => {
    const obj = proxy<{ count1: number; count2?: number }>({
      count1: 0,
      count2: 0,
    })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.count1 += 1
    obj.count2 = 2

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
    expect(handler).lastCalledWith([
      ['set', ['count1'], 1],
      ['set', ['count2'], 2],
    ])

    delete obj.count2

    await Promise.resolve()
    expect(handler).toBeCalledTimes(2)
    expect(handler).lastCalledWith([['delete', ['count2'], undefined]])
  })

  it('should notify nested ops', async () => {
    const obj = proxy<{ nested: { count?: number } }>({ nested: { count: 0 } })
    const handler = jest.fn()

    subscribe(obj, handler)

    obj.nested.count = 1

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
    expect(handler).lastCalledWith([['set', ['nested', 'count'], 1]])

    delete obj.nested.count

    await Promise.resolve()
    expect(handler).toBeCalledTimes(2)
    expect(handler).lastCalledWith([['delete', ['nested', 'count'], undefined]])
  })
})

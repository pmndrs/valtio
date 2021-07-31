import { proxy, snapshot, subscribe } from '../src/index'
import { derive } from '../src/utils'

it('basic derive', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    text: '',
    count: 0,
  })
  const derived = derive({
    doubled: (get) => computeDouble(get(state).count),
  })

  const callback = jest.fn()
  subscribe(derived, callback)

  expect(snapshot(derived)).toMatchObject({ doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)
  expect(callback).toBeCalledTimes(0)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(derived)).toMatchObject({ doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(derived)).toMatchObject({ doubled: 2 })
  expect(computeDouble).toBeCalledTimes(3)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)
})

it('derive another proxy', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    text: '',
    count: 0,
  })
  const anotherState = proxy({})
  derive(
    {
      doubled: (get) => computeDouble(get(state).count),
    },
    {
      proxy: anotherState,
    }
  )

  const callback = jest.fn()
  subscribe(anotherState, callback)

  expect(snapshot(anotherState)).toMatchObject({ doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)
  expect(callback).toBeCalledTimes(0)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(anotherState)).toMatchObject({ doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(anotherState)).toMatchObject({ doubled: 2 })
  expect(computeDouble).toBeCalledTimes(3)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)
})

it('derive with self', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    text: '',
    count: 0,
  })
  derive(
    {
      doubled: (get) => computeDouble(get(state).count),
    },
    {
      proxy: state,
    }
  )

  const callback = jest.fn()
  subscribe(state, callback)

  expect(snapshot(state)).toMatchObject({ text: '', count: 0, doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)
  expect(callback).toBeCalledTimes(0)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: '', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: 'a', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(4)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(2)
})

it('derive with two dependencies', async () => {
  const computeSum = jest.fn((x, y) => x + y)
  const state1 = proxy({ count: 1 })
  const state2 = proxy({ count: 10 })
  const derived = derive({
    sum: (get) => computeSum(get(state1).count, get(state2).count),
  })

  const callback = jest.fn()
  subscribe(derived, callback)

  expect(snapshot(derived)).toMatchObject({ sum: 11 })
  expect(computeSum).toBeCalledTimes(1)
  expect(callback).toBeCalledTimes(0)

  state1.count += 1
  await Promise.resolve()
  expect(snapshot(derived)).toMatchObject({ sum: 12 })
  expect(computeSum).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)

  state1.count += 1
  state2.count += 10
  await Promise.resolve()
  expect(snapshot(derived)).toMatchObject({ sum: 23 })
  expect(computeSum).toBeCalledTimes(3)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(2)
})

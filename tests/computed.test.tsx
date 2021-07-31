import React, { StrictMode, Suspense } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { proxy, useSnapshot, snapshot, subscribe } from '../src/index'
import { proxyWithComputed, addComputed } from '../src/utils'

const consoleError = console.error
beforeEach(() => {
  console.error = jest.fn((message) => {
    if (
      process.env.NODE_ENV === 'production' &&
      message.startsWith('act(...) is not supported in production')
    ) {
      return
    }
    consoleError(message)
  })
})
afterEach(() => {
  console.error = consoleError
})

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

it('simple computed getters', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxyWithComputed(
    {
      text: '',
      count: 0,
    },
    {
      doubled: { get: (snap) => computeDouble(snap.count) },
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
  expect(callback).toBeCalledTimes(1)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: 'a', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
  expect(callback).toBeCalledTimes(2)
})

it('computed getters and setters', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxyWithComputed(
    {
      text: '',
      count: 0,
    },
    {
      doubled: {
        get: (snap) => computeDouble(snap.count),
        set: (state, newValue: number) => {
          state.count = newValue / 2
        },
      },
    }
  )

  expect(snapshot(state)).toMatchObject({ text: '', count: 0, doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: '', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)

  state.doubled = 1
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: '', count: 0.5, doubled: 1 })
  expect(computeDouble).toBeCalledTimes(3)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: 'a', count: 0.5, doubled: 1 })
  expect(computeDouble).toBeCalledTimes(3)
})

it('computed setters with object and array', async () => {
  const state = proxyWithComputed(
    {
      obj: { a: 1 },
      arr: [2],
    },
    {
      object: {
        get: (snap) => snap.obj,
        set: (state, newValue: any) => {
          state.obj = newValue
        },
      },
      array: {
        get: (snap) => snap.arr,
        set: (state, newValue: any) => {
          state.arr = newValue
        },
      },
    }
  )

  expect(snapshot(state)).toMatchObject({
    obj: { a: 1 },
    arr: [2],
    object: { a: 1 },
    array: [2],
  })

  state.object = { a: 2 }
  state.array = [3]
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({
    obj: { a: 2 },
    arr: [3],
    object: { a: 2 },
    array: [3],
  })
})

it('simple addComputed', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    text: '',
    count: 0,
  })
  addComputed(state, {
    doubled: (snap) => computeDouble(snap.count),
  })

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
  expect(computeDouble).toBeCalledTimes(2)
  expect(callback).toBeCalledTimes(2)
})

it('async addComputed', async () => {
  const state = proxy({ count: 0 })
  addComputed(state, {
    delayedCount: async (snap) => {
      await sleep(10)
      return snap.count + 1
    },
  })

  const Counter: React.FC = () => {
    const snap = useSnapshot(
      state as { count: number; delayedCount: Promise<number> }
    )
    return (
      <>
        <div>
          count: {snap.count}, delayedCount: {snap.delayedCount}
        </div>
        <button onClick={() => ++state.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>
  )

  await findByText('loading')
  await findByText('count: 0, delayedCount: 1')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('count: 1, delayedCount: 2')
})

it('nested emulation with addComputed', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({ text: '', math: { count: 0 } })
  addComputed(
    state,
    {
      doubled: (snap) => computeDouble(snap.math.count),
    },
    state.math
  )

  const callback = jest.fn()
  subscribe(state, callback)

  expect(snapshot(state)).toMatchObject({
    text: '',
    math: { count: 0, doubled: 0 },
  })
  expect(computeDouble).toBeCalledTimes(1)
  expect(callback).toBeCalledTimes(0)

  state.math.count += 1
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({
    text: '',
    math: { count: 1, doubled: 2 },
  })
  expect(computeDouble).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({
    text: 'a',
    math: { count: 1, doubled: 2 },
  })
  expect(computeDouble).toBeCalledTimes(2)
  expect(callback).toBeCalledTimes(2)
})

it('addComputed with array.pop (#124)', async () => {
  const state = proxy({
    arr: [{ n: 1 }, { n: 2 }, { n: 3 }],
  })
  addComputed(state, {
    nums: (snap) => snap.arr.map((item) => item.n),
  })

  expect(snapshot(state)).toMatchObject({
    arr: [{ n: 1 }, { n: 2 }, { n: 3 }],
    nums: [1, 2, 3],
  })

  state.arr.pop()
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({
    arr: [{ n: 1 }, { n: 2 }],
    nums: [1, 2],
  })
})

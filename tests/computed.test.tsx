import React, { StrictMode, Suspense } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { useProxy, snapshot } from '../src/index'
import { proxyWithComputed } from '../src/utils'

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

  expect(snapshot(state)).toMatchObject({ text: '', count: 0, doubled: 0 })
  expect(computeDouble).toBeCalledTimes(1)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: '', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)

  state.text = 'a'
  await Promise.resolve()
  expect(snapshot(state)).toMatchObject({ text: 'a', count: 1, doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
})

it('async compute getters', async () => {
  const state = proxyWithComputed(
    { count: 0 },
    {
      delayedCount: {
        get: async (snap) => {
          await sleep(10)
          return snap.count + 1
        },
      },
    }
  )

  const Counter: React.FC = () => {
    const snap = useProxy(state)
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

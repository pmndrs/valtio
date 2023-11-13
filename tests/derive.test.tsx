import { StrictMode, Suspense, useEffect, useRef } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, subscribe, useSnapshot } from 'valtio'
import { derive, underive } from 'valtio/utils'

type DeriveGet = <T extends object>(proxyObject: T) => T

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

it('basic derive', async () => {
  const computeDouble = vi.fn((x: number) => x * 2)
  const state = proxy({
    text: '',
    count: 0,
  })
  const derived = derive({
    doubled: (get) => computeDouble(get(state).count),
  })

  const callback = vi.fn()
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
  const computeDouble = vi.fn((x: number) => x * 2)
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
    },
  )

  const callback = vi.fn()
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
  const computeDouble = vi.fn((x: number) => x * 2)
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
    },
  )

  const callback = vi.fn()
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
  expect(computeDouble).toBeCalledTimes(3)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(2)
})

it('derive with two dependencies', async () => {
  const computeSum = vi.fn((x: number, y: number) => x + y)
  const state1 = proxy({ count: 1 })
  const state2 = proxy({ count: 10 })
  const derived = derive({
    sum: (get) => computeSum(get(state1).count, get(state2).count),
  })

  const callback = vi.fn()
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

it('async derive', async () => {
  const state = proxy({ count: 0 })
  derive(
    {
      delayedCount: async (get) => {
        await sleep(300)
        return get(state).count + 1
      },
    },
    { proxy: state },
  )

  const Counter = () => {
    const snap = useSnapshot(
      state as { count: number; delayedCount: Promise<number> },
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
    </StrictMode>,
  )

  await findByText('loading')
  await findByText('count: 0, delayedCount: 1')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('count: 1, delayedCount: 2')
})

it('nested emulation with derive', async () => {
  const computeDouble = vi.fn((x: number) => x * 2)
  const state = proxy({ text: '', math: { count: 0 } })
  derive(
    {
      doubled: (get) => computeDouble(get(state.math).count),
    },
    { proxy: state.math, sync: true },
  )

  const callback = vi.fn()
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
  await Promise.resolve()
  expect(callback).toBeCalledTimes(2)
})

it('derive with array.pop', async () => {
  const state = proxy({
    arr: [{ n: 1 }, { n: 2 }, { n: 3 }],
  })
  derive(
    {
      nums: (get) => get(state.arr).map((item) => item.n),
    },
    { proxy: state },
  )

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

it('basic underive', async () => {
  const computeDouble = vi.fn((x: number) => x * 2)
  const state = proxy({ count: 0 })
  const derived = derive({
    doubled: (get) => computeDouble(get(state).count),
  })

  const callback = vi.fn()
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

  underive(derived)

  state.count += 1
  await Promise.resolve()
  expect(snapshot(derived)).toMatchObject({ doubled: 2 })
  expect(computeDouble).toBeCalledTimes(2)
  await Promise.resolve()
  expect(callback).toBeCalledTimes(1)
})

describe('glitch free', () => {
  it('basic (#296)', async () => {
    const state = proxy({ value: 0 })
    const derived1 = derive({ value: (get) => get(state).value })
    const derived2 = derive({ value: (get) => get(derived1).value })
    const computeValue = vi.fn((get: DeriveGet) => {
      const v0 = get(state).value
      const v1 = get(derived1).value
      const v2 = get(derived2).value
      return `v0: ${v0}, v1: ${v1}, v2: ${v2}`
    })
    const derived3 = derive({ value: computeValue })

    const App = () => {
      const snap = useSnapshot(derived3)
      const commitsRef = useRef(1)
      useEffect(() => {
        commitsRef.current += 1
      })
      return (
        <>
          value: {snap.value} (commits: {commitsRef.current})
          <button onClick={() => ++state.value}>button</button>
        </>
      )
    }

    const { getByText, findByText } = render(
      <>
        <App />
      </>,
    )

    await findByText('value: v0: 0, v1: 0, v2: 0 (commits: 1)')
    expect(computeValue).toBeCalledTimes(1)

    fireEvent.click(getByText('button'))
    await findByText('value: v0: 1, v1: 1, v2: 1 (commits: 2)')
    expect(computeValue).toBeCalledTimes(2)
  })

  it('same value', async () => {
    const state = proxy({ value: 0 })
    const derived1 = derive({
      value: (get) => get(state).value * 0,
    })
    const derived2 = derive({
      value: (get) => get(derived1).value * 0,
    })
    const computeValue = vi.fn((get: DeriveGet) => {
      const v0 = get(state).value
      const v1 = get(derived1).value
      const v2 = get(derived2).value
      return v0 + (v1 - v2)
    })
    const derived3 = derive({
      value: (get) => computeValue(get),
    })

    const App = () => {
      const snap = useSnapshot(derived3)
      return (
        <div>
          value: {snap.value}
          <button onClick={() => ++state.value}>button</button>
        </div>
      )
    }

    const { getByText, findByText } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await findByText('value: 0')
    expect(computeValue).toBeCalledTimes(1)

    fireEvent.click(getByText('button'))
    await findByText('value: 1')
    expect(computeValue).toBeCalledTimes(2)
  })

  it('double chain', async () => {
    const state = proxy({ value: 0 })
    const derived1 = derive({
      value: (get) => get(state).value,
    })
    const derived2 = derive({
      value: (get) => get(derived1).value,
    })
    const derived3 = derive({
      value: (get) => get(derived2).value,
    })
    const computeValue = vi.fn((get: DeriveGet) => {
      const v0 = get(state).value
      const v1 = get(derived1).value
      const v2 = get(derived2).value
      const v3 = get(derived3).value
      return v0 + (v1 - v2) + v3 * 0
    })
    const derived4 = derive({
      value: (get) => computeValue(get),
    })

    const App = () => {
      const snap = useSnapshot(derived4)
      return (
        <div>
          value: {snap.value}
          <button onClick={() => ++state.value}>button</button>
        </div>
      )
    }

    const { getByText, findByText } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await findByText('value: 0')
    expect(computeValue).toBeCalledTimes(1)

    fireEvent.click(getByText('button'))
    await findByText('value: 1')
    expect(computeValue).toBeCalledTimes(2)
  })
})

describe('two derived properties', () => {
  type State = {
    a: number
    derived1?: unknown
    derived2?: unknown
  }

  it('two derived properties both returning primitive values (#349)', async () => {
    const state: State = proxy({ a: 1 })
    derive(
      {
        derived1: (get) => {
          get(state).a
          return 1
        },
      },
      { proxy: state },
    )
    derive(
      {
        derived2: (get) => {
          get(state).a
          return 1
        },
      },
      { proxy: state },
    )
    await Promise.resolve()
    expect(state.derived1).toBeDefined()
    expect(state.derived2).toBeDefined()
  })

  it('two derived properties both returning non primitive values, defined at the same time (#349)', async () => {
    const state: State = proxy({ a: 1 })
    derive(
      {
        derived1: (get) => {
          get(state).a
          return {}
        },
        derived2: (get) => {
          get(state).a
          return {}
        },
      },
      { proxy: state },
    )
    await Promise.resolve()
    expect(state.derived1).toBeDefined()
    expect(state.derived2).toBeDefined()
  })

  it('two derived properties both returning non primitive values (#349)', async () => {
    const state: State = proxy({ a: 1 })
    derive(
      {
        derived1: (get) => {
          get(state).a
          return {}
        },
      },
      { proxy: state },
    )
    derive(
      {
        derived2: (get) => {
          get(state).a
          return {}
        },
      },
      { proxy: state },
    )
    await Promise.resolve()
    expect(state.derived1).toBeDefined()
    expect(state.derived2).toBeDefined()
  })
})

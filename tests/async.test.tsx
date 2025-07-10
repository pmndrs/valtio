/// <reference types="react/canary" />

import ReactExports, { StrictMode, Suspense } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const { use } = ReactExports
const use2 = <T,>(x: T): Awaited<T> =>
  x instanceof Promise ? use(x) : (x as Awaited<T>)

it.skipIf(typeof use === 'undefined')('delayed increment', async () => {
  const state = proxy<any>({ count: 0 })
  const delayedIncrement = () => {
    const nextCount = state.count + 1
    state.count = sleep(300).then(() => nextCount)
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {use2(snap.count)}</div>
        <button onClick={delayedIncrement}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('count: 0')).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('loading')).toBeInTheDocument(),
  )
  await vi.waitFor(() =>
    expect(screen.getByText('count: 1')).toBeInTheDocument(),
  )
})

it.skipIf(typeof use === 'undefined')('delayed object', async () => {
  const state = proxy<any>({ object: { text: 'none' } })
  const delayedObject = () => {
    state.object = sleep(300).then(() => ({ text: 'hello' }))
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>text: {use2(snap.object).text}</div>
        <button onClick={delayedObject}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('text: none')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('loading')).toBeInTheDocument(),
  )
  await vi.waitFor(() =>
    expect(screen.getByText('text: hello')).toBeInTheDocument(),
  )
})

it.skipIf(typeof use === 'undefined')(
  'delayed object update fulfilled',
  async () => {
    const state = proxy<any>({
      object: sleep(300).then(() => ({ text: 'counter', count: 0 })),
    })
    const updateObject = () => {
      state.object = state.object.then((v: any) =>
        sleep(300).then(() => ({ ...v, count: v.count + 1 })),
      )
    }

    const Counter = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>text: {use2(snap.object).text}</div>
          <div>count: {use2(snap.object).count}</div>
          <button onClick={updateObject}>button</button>
        </>
      )
    }

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(() =>
      render(
        <StrictMode>
          <Suspense fallback="loading">
            <Counter />
          </Suspense>
        </StrictMode>,
      ),
    )

    await vi.waitFor(() =>
      expect(screen.getByText('loading')).toBeInTheDocument(),
    )
    await vi.waitFor(() => {
      expect(screen.getByText('text: counter')).toBeInTheDocument()
      expect(screen.getByText('count: 0')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('button'))

    await vi.waitFor(() =>
      expect(screen.getByText('loading')).toBeInTheDocument(),
    )
    await vi.waitFor(() => {
      expect(screen.getByText('text: counter')).toBeInTheDocument()
      expect(screen.getByText('count: 1')).toBeInTheDocument()
    })
  },
)

it.skipIf(typeof use === 'undefined')('delayed falsy value', async () => {
  const state = proxy<any>({ value: true })
  const delayedValue = () => {
    state.value = sleep(300).then(() => null)
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>value: {String(use2(snap.value))}</div>
        <button onClick={delayedValue}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Suspense fallback="loading">
        <Counter />
      </Suspense>
    </StrictMode>,
  )

  await vi.waitFor(() =>
    expect(screen.getByText('value: true')).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByText('button'))
  await vi.waitFor(() =>
    expect(screen.getByText('loading')).toBeInTheDocument(),
  )
  await vi.waitFor(() =>
    expect(screen.getByText('value: null')).toBeInTheDocument(),
  )
})

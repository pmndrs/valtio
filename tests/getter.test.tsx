import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

it('simple object getters', async () => {
  const computeDouble = vi.fn((x: number) => x * 2)
  const state = proxy({
    count: 0,
    get doubled() {
      return computeDouble(this.count)
    },
  })

  const Counter = ({ name }: { name: string }) => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>
          {name} count: {snap.doubled}
        </div>
        <button onClick={() => ++state.count}>{name} button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter name="A" />
      <Counter name="B" />
    </StrictMode>,
  )

  await waitFor(() => {
    screen.getByText('A count: 0')
    screen.getByText('B count: 0')
  })

  computeDouble.mockClear()
  fireEvent.click(screen.getByText('A button'))
  await waitFor(() => {
    screen.getByText('A count: 2')
    screen.getByText('B count: 2')
  })
  expect(computeDouble).toBeCalledTimes(1)
})

it('object getters returning object', async () => {
  const computeDouble = vi.fn((x: number) => x * 2)
  const state = proxy({
    count: 0,
    get doubled() {
      return { value: computeDouble(this.count) }
    },
  })

  const Counter = ({ name }: { name: string }) => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>
          {name} count: {snap.doubled.value}
        </div>
        <button onClick={() => ++state.count}>{name} button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter name="A" />
      <Counter name="B" />
    </StrictMode>,
  )

  await waitFor(() => {
    screen.getByText('A count: 0')
    screen.getByText('B count: 0')
  })

  computeDouble.mockClear()
  fireEvent.click(screen.getByText('A button'))
  await waitFor(() => {
    screen.getByText('A count: 2')
    screen.getByText('B count: 2')
  })
  expect(computeDouble).toBeCalledTimes(1)
})

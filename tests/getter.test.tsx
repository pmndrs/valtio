import React, { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from '../src/index'

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

it('simple object getters', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    count: 0,
    get doubled() {
      return computeDouble(this.count)
    },
  })

  const Counter: React.FC<{ name: string }> = ({ name }) => {
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

  const { getByText } = render(
    <StrictMode>
      <Counter name="A" />
      <Counter name="B" />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('A count: 0')
    getByText('B count: 0')
  })

  computeDouble.mockClear()
  fireEvent.click(getByText('A button'))
  await waitFor(() => {
    getByText('A count: 2')
    getByText('B count: 2')
  })
  expect(computeDouble).toBeCalledTimes(1)
})

it('object getters returning object', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    count: 0,
    get doubled() {
      return { value: computeDouble(this.count) }
    },
  })

  const Counter: React.FC<{ name: string }> = ({ name }) => {
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

  const { getByText } = render(
    <StrictMode>
      <Counter name="A" />
      <Counter name="B" />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('A count: 0')
    getByText('B count: 0')
  })

  computeDouble.mockClear()
  fireEvent.click(getByText('A button'))
  await waitFor(() => {
    getByText('A count: 2')
    getByText('B count: 2')
  })
  expect(computeDouble).toBeCalledTimes(1)
})

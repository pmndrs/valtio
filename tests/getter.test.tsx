import React, { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useProxy } from '../src/index'

it('simple object getters', async () => {
  const computeDouble = jest.fn((x) => x * 2)
  const state = proxy({
    count: 0,
    get doubled() {
      return computeDouble(this.count)
    },
  })

  const Counter: React.FC<{ name: string }> = ({ name }) => {
    const snapshot = useProxy(state)
    return (
      <>
        <div>
          {name} count: {snapshot.doubled}
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
    const snapshot = useProxy(state)
    return (
      <>
        <div>
          {name} count: {snapshot.doubled.value}
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

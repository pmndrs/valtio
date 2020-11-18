import React, { StrictMode, Suspense } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { proxy, useProxy } from '../src/index'

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

it('delayed increment', async () => {
  const state = proxy<any>({ count: 0 })
  const delayedIncrement = () => {
    const nextCount = state.count + 1
    state.count = sleep(10).then(() => nextCount)
  }

  const Counter: React.FC = () => {
    const snapshot = useProxy(state)
    return (
      <>
        <div>count: {snapshot.count}</div>
        <button onClick={delayedIncrement}>button</button>
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

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('count: 1')
})

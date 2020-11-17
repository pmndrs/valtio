import React, { StrictMode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { create, useProxy } from '../src/index'

it('a simple counter', async () => {
  const obj = create({ count: 0 })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 1')
})

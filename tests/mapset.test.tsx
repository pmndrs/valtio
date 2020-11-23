import React, { StrictMode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { proxy, useProxy } from '../src/index'

it('unsupported map', async () => {
  const obj = proxy({ map: new Map([['count', 0]]) })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.map.get('count')}</div>
        <button onClick={() => obj.map.set('count', 1)}>button</button>
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
  await new Promise((resolve) => setTimeout(resolve, 10)) // FIXME better way?
  expect(() => getByText('count: 1')).toThrow()
})

it('unsupported set', async () => {
  const obj = proxy({ set: new Set([1, 2, 3]) })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {[...snapshot.set].join(',')}</div>
        <button onClick={() => obj.set.add(4)}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 1,2,3')

  fireEvent.click(getByText('button'))
  await new Promise((resolve) => setTimeout(resolve, 10)) // FIXME better way?
  expect(() => getByText('count: 1,2,3,4')).toThrow()
})

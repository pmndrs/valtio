import React, { StrictMode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { useSnapshot } from '../src/index'
import { proxyWithHistory } from '../src/utils'

it('simple count', async () => {
  const state = proxyWithHistory(0)

  const Counter: React.FC = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value}</div>
        <button onClick={() => ++state.value}>inc</button>
        <button onClick={snap.undo}>undo</button>
        <button onClick={snap.redo}>redo</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('inc'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('redo'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo'))
  await findByText('count: 1')
})

it('count in object', async () => {
  const state = proxyWithHistory({ count: 0 })

  const Counter: React.FC = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value.count}</div>
        <button onClick={() => ++state.value.count}>inc</button>
        <button onClick={snap.undo}>undo</button>
        <button onClick={snap.redo}>redo</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('inc'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('redo'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo'))
  await findByText('count: 1')
})

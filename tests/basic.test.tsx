import React, { StrictMode, useRef, useEffect } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { create, useProxy } from '../src/index'

it('simple counter', async () => {
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

it('no extra re-renders', async () => {
  const obj = create({ count: 0, count2: 0 })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snapshot.count} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  const Counter2: React.FC = () => {
    const snapshot = useProxy(obj)
    const commitsRef = useRef(0)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count2: {snapshot.count2} ({commitsRef.current})
        </div>
        <button onClick={() => ++obj.count2}>button2</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <Counter />
      <Counter2 />
    </StrictMode>
  )

  await waitFor(() => {
    getByText('count: 0 (0)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('count2: 0 (0)')
  })

  fireEvent.click(getByText('button2'))
  await waitFor(() => {
    getByText('count: 1 (1)')
    getByText('count2: 1 (1)')
  })
})

it('object in object', async () => {
  const obj = create({ object: { count: 0 } })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.object.count}</div>
        <button onClick={() => ++obj.object.count}>button</button>
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

it('array in object', async () => {
  const obj = create({ counts: [0, 1, 2] })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>counts: {snapshot.counts.join(',')}</div>
        <button onClick={() => obj.counts.push(obj.counts.length)}>
          button
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('counts: 0,1,2')

  fireEvent.click(getByText('button'))
  await findByText('counts: 0,1,2,3')
})

it.skip('circular object', async () => {
  const obj = create<any>({ object: {} })
  obj.object = obj
  obj.object.count = 0

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

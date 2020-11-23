import React, { StrictMode, useRef, useEffect } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useProxy } from '../src/index'

it('simple counter', async () => {
  const obj = proxy({ count: 0 })

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

it.only('no extra re-renders', async () => {
  const obj = proxy({ count: 0, count2: 0 })

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
  const obj = proxy({ object: { count: 0 } })

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
  const obj = proxy({ counts: [0, 1, 2] })

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

it('array length after direct assignment', async () => {
  const obj = proxy({ counts: [0, 1, 2] })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>counts: {snapshot.counts.join(',')}</div>
        <div>length: {snapshot.counts.length}</div>
        <button
          onClick={() => (obj.counts[obj.counts.length] = obj.counts.length)}>
          increment
        </button>
        <button
          onClick={() =>
            (obj.counts[obj.counts.length + 5] = obj.counts.length + 5)
          }>
          jump
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

  fireEvent.click(getByText('increment'))
  await findByText('counts: 0,1,2,3')

  fireEvent.click(getByText('jump'))
  await findByText('counts: 0,1,2,3,,,,,,9')
})

it('deleting property', async () => {
  const obj = proxy<{ count?: number }>({ count: 1 })

  const Counter: React.FC = () => {
    const snapshot = useProxy(obj)
    return (
      <>
        <div>count: {snapshot.count ?? 'none'}</div>
        <button onClick={() => delete obj.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 1')

  fireEvent.click(getByText('button'))
  await findByText('count: none')
})

it('circular object', async () => {
  const obj = proxy<any>({ object: {} })
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

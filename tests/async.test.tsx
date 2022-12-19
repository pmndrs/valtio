import { StrictMode, Suspense } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

it('delayed increment', async () => {
  const state = proxy<any>({ count: 0 })
  const delayedIncrement = () => {
    const nextCount = state.count + 1
    state.count = sleep(300).then(() => nextCount)
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.count}</div>
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

it('delayed object', async () => {
  const state = proxy<any>({ object: { text: 'none' } })
  const delayedObject = () => {
    state.object = sleep(300).then(() => ({ text: 'hello' }))
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>text: {snap.object.text}</div>
        <button onClick={delayedObject}>button</button>
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

  await findByText('text: none')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('text: hello')
})

it('delayed object update fulfilled', async () => {
  const state = proxy<any>({
    object: sleep(300).then(() => ({ text: 'counter', count: 0 })),
  })
  const updateObject = () => {
    state.object = state.object.then((v: any) =>
      sleep(300).then(() => ({ ...v, count: v.count + 1 }))
    )
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>text: {snap.object.text}</div>
        <div>count: {snap.object.count}</div>
        <button onClick={updateObject}>button</button>
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

  await findByText('loading')
  await waitFor(() => {
    getByText('text: counter')
    getByText('count: 0')
  })

  fireEvent.click(getByText('button'))

  await findByText('loading')
  await waitFor(() => {
    getByText('text: counter')
    getByText('count: 1')
  })
})

it('delayed falsy value', async () => {
  const state = proxy<any>({ value: true })
  const delayedValue = () => {
    state.value = sleep(300).then(() => null)
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>value: {String(snap.value)}</div>
        <button onClick={delayedValue}>button</button>
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

  await findByText('value: true')

  fireEvent.click(getByText('button'))
  await findByText('loading')
  await findByText('value: null')
})

it('lazy delayed increment', async () => {
  // make a lazily updated async state
  let intervalId: string | number | NodeJS.Timeout | undefined
  const state = proxy<any>(
    { count: 0, counting: false },
    () => {
      // initialize the value on observe
      state.count = 10
      // and start an async interval to update it
      intervalId = setInterval(() => {
        state.count += 1
      }, 100)
    },
    () => {
      // clear async interval when no longer observed
      clearInterval(intervalId)
      intervalId = -1
    }
  )

  const toggleIncrement = () => {
    state.counting = !state.counting
  }

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        {state.counting && <div>count: {snap.count}</div>}
        <button onClick={toggleIncrement}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  fireEvent.click(getByText('button'))
  // expect initial value to have been set
  await findByText('count: 10')
  // expect timer to be running
  await findByText('count: 11')
  expect(intervalId !== -1)
  fireEvent.click(getByText('button'))
  // expect timer to have stopped
  await findByText('count: 11')
  expect(intervalId === -1)
  sleep(200)
  await findByText('count: 11')
})

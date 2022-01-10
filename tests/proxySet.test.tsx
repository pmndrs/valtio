import { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot, snapshot } from 'valtio'
import { proxySet } from 'valtio/utils/proxySet'

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

it('support adding value and lookup', async () => {
  const state = proxy({
    set: proxySet(),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <div>hasValue: {snap.set.has('aValue').toString()}</div>
        <button onClick={() => state.set.add('aValue')}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )
  getByText('hasValue: false')
  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('hasValue: true')
  })
})

it('report size', async () => {
  const state = proxy({
    set: proxySet(),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <div>size: {snap.set.size}</div>
        <button onClick={() => state.set.add('aValue')}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )
  getByText('size: 0')
  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('size: 1')
  })
})

it('prevent duplicate value', async () => {
  const state = proxy({
    set: proxySet(),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <div>size: {snap.set.size}</div>
        <button onClick={() => state.set.add('aValue')}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('size: 1')
  })

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('size: 1')
  })
})

it('support delete', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <div>size: {snap.set.size}</div>
        <div>hasValue: {snap.set.has(2).toString()}</div>
        <button onClick={() => state.set.delete(2)}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  getByText('size: 3')
  getByText('hasValue: true')

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('size: 2')
    getByText('hasValue: false')
  })
})

it('return false when nothing to delete', () => {
  const state = proxy({
    set: proxySet([1]),
  })

  expect(snapshot(state).set.delete(10)).toBe(false)
})

it('support clear', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <div>size: {snap.set.size}</div>
        <button onClick={() => state.set.clear()}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  getByText('size: 3')

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('size: 0')
  })
})

it('support forEach', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    const renderWithForEach = () => {
      const children: number[] = []
      snap.set.forEach((v) => {
        children.push(v)
      })

      return children.join(',')
    }

    return (
      <>
        <ul>children: {renderWithForEach()}</ul>
        <button onClick={() => state.set.add(4)}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  getByText('children: 1,2,3')

  expect(() => getByText('children: 1,2,3,4')).toThrow()

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('children: 1,2,3,4')
  })
})

it('support map', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <ul>
          {snap.set.map((v) => (
            <li key={v}>children: {v}</li>
          ))}
        </ul>
        <button onClick={() => state.set.add(4)}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  ;[1, 2, 3].forEach((v) => {
    getByText(`children: ${v}`)
  })

  expect(() => getByText('children: 4')).toThrow()

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    ;[1, 2, 3, 4].forEach((v) => {
      getByText(`children: ${v}`)
    })
  })
})

it('support filter', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    return (
      <>
        <ul>
          {snap.set
            .filter((v) => v !== 1)
            .map((v) => (
              <li key={v}>children: {v}</li>
            ))}
        </ul>
        <button onClick={() => state.set.add(4)}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  ;[2, 3].forEach((v) => {
    getByText(`children: ${v}`)
  })

  expect(() => getByText('children: 1')).toThrow()
  expect(() => getByText('children: 4')).toThrow()

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    ;[2, 3, 4].forEach((v) => {
      getByText(`children: ${v}`)
    })
  })
})

it('support toString', async () => {
  const state = proxy({
    set: proxySet([1, 2, 3]),
  })

  const TestComponent = () => {
    const snap = useSnapshot(state)

    // using template literal to ensure that `toString` method is properly called
    return (
      <>
        <div>children: {`${snap.set}`}</div>
        <button onClick={() => state.set.add(4)}>button</button>
      </>
    )
  }

  const { getByText } = render(
    <StrictMode>
      <TestComponent />
    </StrictMode>
  )

  getByText('children: 1,2,3')

  fireEvent.click(getByText('button'))
  await waitFor(() => {
    getByText('children: 1,2,3,4')
  })
})

it('support toJSON', async () => {
  const initialValue = [
    { id: 1, val: 'hello' },
    { id: 2, val: 'world' },
  ]

  const state = proxy({
    set: proxySet(initialValue),
  })
  expect(JSON.stringify(snapshot(state).set)).toMatch(
    JSON.stringify(initialValue)
  )
})

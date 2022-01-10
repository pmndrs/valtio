import { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, snapshot, useSnapshot } from 'valtio'
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

it('support features parity with native Set', () => {
  const set = proxySet([1, 2, 3])
  const nativeSet = new Set([1, 2, 3])

  // check for Symbol.toStringTag
  expect(`${set}`).toBe(`${nativeSet}`)

  // everytime we modify the proxy set we ensure
  // that the output is the same as the native set
  const matchWithNativeSet = () => {
    expect(set.size).toBe(nativeSet.size)
    expect(Array.from(set.values())).toStrictEqual(
      Array.from(nativeSet.values())
    )
    expect(Array.from(set.keys())).toStrictEqual(Array.from(nativeSet.keys()))
    expect(Array.from(set.entries())).toStrictEqual(
      Array.from(nativeSet.entries())
    )

    for (const value of set) {
      expect(nativeSet.has(value)).toBe(true)
    }
  }

  set.add(4)
  nativeSet.add(4)
  expect(set.has(4)).toBe(nativeSet.has(4))
  matchWithNativeSet()

  expect(set.delete(2)).toBe(nativeSet.delete(2))
  matchWithNativeSet()

  set.clear()
  nativeSet.clear()
  matchWithNativeSet()
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

import { Suspense } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'
import { devtools } from 'valtio/utils'

let extensionSubscriber: ((message: any) => void) | undefined

const extension = {
  subscribe: jest.fn((f) => {
    extensionSubscriber = f
    return () => {}
  }),
  unsubscribe: jest.fn(),
  send: jest.fn(),
  init: jest.fn(),
  error: jest.fn(),
}
const extensionConnector = { connect: jest.fn(() => extension) }
;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extensionConnector

beforeEach(() => {
  extensionConnector.connect.mockClear()
  extension.subscribe.mockClear()
  extension.unsubscribe.mockClear()
  extension.send.mockClear()
  extension.init.mockClear()
  extension.error.mockClear()
  extensionSubscriber = undefined
})

it('connects to the extension by initialiing', () => {
  const obj = proxy({ count: 0 })
  devtools(obj, { enabled: true })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  render(<Counter />)

  expect(extension.init).toHaveBeenLastCalledWith({ count: 0 })
})

describe('If there is no extension installed...', () => {
  let savedConsoleWarn: any
  let savedDEV: boolean
  beforeEach(() => {
    savedConsoleWarn = console.warn
    console.warn = jest.fn()
    savedDEV = __DEV__
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = undefined
  })
  afterEach(() => {
    console.warn = savedConsoleWarn
    __DEV__ = savedDEV
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extensionConnector
  })

  it('does not throw', () => {
    const obj = proxy({ count: 0 })
    devtools(obj)
    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }
    expect(() => {
      render(<Counter />)
    }).not.toThrow()
  })

  it('does not warn if enabled is undefined', () => {
    const obj = proxy({ count: 0 })
    devtools(obj)
    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }
    render(<Counter />)
    expect(console.warn).not.toBeCalled()
  })

  it('[DEV-ONLY] warns if enabled is true', () => {
    __DEV__ = true
    const obj = proxy({ count: 0 })
    devtools(obj, { enabled: true })
    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }
    render(<Counter />)
    expect(console.warn).toHaveBeenLastCalledWith(
      '[Warning] Please install/enable Redux devtools extension'
    )
  })

  it('[PRD-ONLY] does not warn even if enabled is true', () => {
    __DEV__ = false
    const obj = proxy({ count: 0 })
    devtools(obj, { enabled: true })
    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }
    render(<Counter />)
    expect(console.warn).not.toBeCalled()
  })
})

it('updating state should call devtools.send', async () => {
  const obj = proxy({ count: 0 })
  devtools(obj, { enabled: true })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.count}</div>
        <button onClick={() => ++obj.count}>button</button>
      </>
    )
  }

  extension.send.mockClear()
  const { getByText, findByText } = render(<Counter />)

  expect(extension.send).toBeCalledTimes(0)
  fireEvent.click(getByText('button'))
  await findByText('count: 1')
  expect(extension.send).toBeCalledTimes(1)
  fireEvent.click(getByText('button'))
  await findByText('count: 2')
  expect(extension.send).toBeCalledTimes(2)
})

describe('when it receives an message of type...', () => {
  it('updating state with ACTION', async () => {
    const obj = proxy({ count: 0 })
    devtools(obj, { enabled: true })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    extension.send.mockClear()
    const { getByText, findByText } = render(
      <Suspense fallback={'loading'}>
        <Counter />
      </Suspense>
    )

    expect(extension.send).toBeCalledTimes(0)
    fireEvent.click(getByText('button'))
    await findByText('count: 1')
    expect(extension.send).toBeCalledTimes(1)
    act(() =>
      (extensionSubscriber as (message: any) => void)({
        type: 'ACTION',
        payload: JSON.stringify({ count: 0 }),
      })
    )
    await findByText('count: 0')
    expect(extension.send).toBeCalledTimes(2)
  })

  describe('DISPATCH and payload of type...', () => {
    it('dispatch & COMMIT', async () => {
      const obj = proxy({ count: 0 })
      devtools(obj, { enabled: true })

      const Counter = () => {
        const snap = useSnapshot(obj)
        return (
          <>
            <div>count: {snap.count}</div>
            <button onClick={() => ++obj.count}>button</button>
          </>
        )
      }

      extension.send.mockClear()
      const { getByText, findByText } = render(<Counter />)

      expect(extension.send).toBeCalledTimes(0)
      fireEvent.click(getByText('button'))
      await findByText('count: 1')
      expect(extension.send).toBeCalledTimes(1)
      fireEvent.click(getByText('button'))
      await findByText('count: 2')
      act(() =>
        (extensionSubscriber as (message: any) => void)({
          type: 'DISPATCH',
          payload: { type: 'COMMIT' },
        })
      )
      await findByText('count: 2')
      expect(extension.init).toBeCalledWith({ count: 2 })
    })

    it('dispatch & IMPORT_STATE', async () => {
      const obj = proxy({ count: 0 })
      devtools(obj, { enabled: true })

      const Counter = () => {
        const snap = useSnapshot(obj)
        return (
          <>
            <div>count: {snap.count}</div>
            <button onClick={() => ++obj.count}>button</button>
          </>
        )
      }

      extension.send.mockClear()
      const { getByText, findByText } = render(<Counter />)

      const nextLiftedState = {
        actionsById: ['5', '6'],
        computedStates: [{ state: { count: 5 } }, { state: { count: 6 } }],
      }

      expect(extension.send).toBeCalledTimes(0)
      fireEvent.click(getByText('button'))
      await findByText('count: 1')
      expect(extension.send).toBeCalledTimes(1)
      fireEvent.click(getByText('button'))
      await findByText('count: 2')
      act(() =>
        (extensionSubscriber as (message: any) => void)({
          type: 'DISPATCH',
          payload: { type: 'IMPORT_STATE', nextLiftedState },
        })
      )
      expect(extension.init).toBeCalledWith({ count: 5 })
      await findByText('count: 6')
    })

    describe('JUMP_TO_STATE | JUMP_TO_ACTION...', () => {
      it('time travelling', async () => {
        const obj = proxy({ count: 0 })
        devtools(obj, { enabled: true })

        const Counter = () => {
          const snap = useSnapshot(obj)
          return (
            <>
              <div>count: {snap.count}</div>
              <button onClick={() => ++obj.count}>button</button>
            </>
          )
        }

        extension.send.mockClear()
        const { getByText, findByText } = render(<Counter />)

        expect(extension.send).toBeCalledTimes(0)
        fireEvent.click(getByText('button'))
        await findByText('count: 1')
        expect(extension.send).toBeCalledTimes(1)
        act(() =>
          (extensionSubscriber as (message: any) => void)({
            type: 'DISPATCH',
            payload: { type: 'JUMP_TO_ACTION' },
            state: JSON.stringify({ count: 0 }),
          })
        )
        await findByText('count: 0')
        expect(extension.send).toBeCalledTimes(1)
        fireEvent.click(getByText('button'))
        await findByText('count: 1')
        fireEvent.click(getByText('button'))
        await findByText('count: 2')
        expect(extension.send).toBeCalledTimes(3)
      })
    })
  })
})

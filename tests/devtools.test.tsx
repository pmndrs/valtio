import { StrictMode, Suspense } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { devtools } from 'valtio/utils'

beforeEach(() => {
  extensionConnector.connect.mockClear()
  extension.subscribe.mockClear()
  extension.unsubscribe.mockClear()
  extension.send.mockClear()
  extension.init.mockClear()
  extension.error.mockClear()
  extensionSubscriber = undefined
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

let extensionSubscriber: ((message: any) => void) | undefined

const extension = {
  subscribe: vi.fn((f: typeof extensionSubscriber) => {
    extensionSubscriber = f
    return () => {}
  }),
  unsubscribe: vi.fn(),
  send: vi.fn(),
  init: vi.fn(),
  error: vi.fn(),
}
const extensionConnector = { connect: vi.fn(() => extension) }
;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = extensionConnector

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

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  expect(extension.init).toHaveBeenLastCalledWith({ count: 0 })
})

describe('If there is no extension installed...', () => {
  let savedConsoleWarn: any
  beforeEach(() => {
    savedConsoleWarn = console.warn
    console.warn = vi.fn()
    ;(window as any).__REDUX_DEVTOOLS_EXTENSION__ = undefined
  })
  afterEach(() => {
    console.warn = savedConsoleWarn
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
      render(
        <StrictMode>
          <Counter />
        </StrictMode>,
      )
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
    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )
    expect(console.warn).not.toBeCalled()
  })

  it('[DEV-ONLY] warns if enabled is true', () => {
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
    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )
    expect(console.warn).toHaveBeenLastCalledWith(
      '[Warning] Please install/enable Redux devtools extension',
    )
  })

  it.skip('[PRD-ONLY] does not warn even if enabled is true', () => {
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
    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )
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

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  expect(extension.send).toBeCalledTimes(0)

  fireEvent.click(screen.getByText('button'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('count: 1')).toBeInTheDocument()
  expect(extension.send).toBeCalledTimes(1)

  fireEvent.click(screen.getByText('button'))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('count: 2')).toBeInTheDocument()
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

    render(
      <StrictMode>
        <Suspense fallback={'loading'}>
          <Counter />
        </Suspense>
      </StrictMode>,
    )

    expect(extension.send).toBeCalledTimes(0)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(extension.send).toBeCalledTimes(1)

    act(() =>
      (extensionSubscriber as (message: any) => void)({
        type: 'ACTION',
        payload: JSON.stringify({ count: 0 }),
      }),
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 0')).toBeInTheDocument()
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

      render(
        <StrictMode>
          <Counter />
        </StrictMode>,
      )

      expect(extension.send).toBeCalledTimes(0)

      fireEvent.click(screen.getByText('button'))
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 1')).toBeInTheDocument()
      expect(extension.send).toBeCalledTimes(1)

      fireEvent.click(screen.getByText('button'))
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 2')).toBeInTheDocument()

      act(() =>
        (extensionSubscriber as (message: any) => void)({
          type: 'DISPATCH',
          payload: { type: 'COMMIT' },
        }),
      )
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 2')).toBeInTheDocument()
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

      render(
        <StrictMode>
          <Counter />
        </StrictMode>,
      )

      const nextLiftedState = {
        actionsById: ['5', '6'],
        computedStates: [{ state: { count: 5 } }, { state: { count: 6 } }],
      }

      expect(extension.send).toBeCalledTimes(0)

      fireEvent.click(screen.getByText('button'))
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 1')).toBeInTheDocument()
      expect(extension.send).toBeCalledTimes(1)

      fireEvent.click(screen.getByText('button'))
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('count: 2')).toBeInTheDocument()

      act(() =>
        (extensionSubscriber as (message: any) => void)({
          type: 'DISPATCH',
          payload: { type: 'IMPORT_STATE', nextLiftedState },
        }),
      )
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(extension.init).toBeCalledWith({ count: 5 })
      expect(screen.getByText('count: 6')).toBeInTheDocument()
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

        render(
          <StrictMode>
            <Counter />
          </StrictMode>,
        )

        expect(extension.send).toBeCalledTimes(0)

        fireEvent.click(screen.getByText('button'))
        await act(() => vi.advanceTimersByTimeAsync(0))
        expect(screen.getByText('count: 1')).toBeInTheDocument()
        expect(extension.send).toBeCalledTimes(1)

        act(() =>
          (extensionSubscriber as (message: any) => void)({
            type: 'DISPATCH',
            payload: { type: 'JUMP_TO_ACTION' },
            state: JSON.stringify({ count: 0 }),
          }),
        )
        await act(() => vi.advanceTimersByTimeAsync(0))
        expect(screen.getByText('count: 0')).toBeInTheDocument()
        expect(extension.send).toBeCalledTimes(1)

        fireEvent.click(screen.getByText('button'))
        await act(() => vi.advanceTimersByTimeAsync(0))
        expect(screen.getByText('count: 1')).toBeInTheDocument()

        fireEvent.click(screen.getByText('button'))
        await act(() => vi.advanceTimersByTimeAsync(0))
        expect(screen.getByText('count: 2')).toBeInTheDocument()
        expect(extension.send).toBeCalledTimes(3)
      })
    })
  })
})

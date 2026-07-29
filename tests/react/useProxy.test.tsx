import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { useProxy } from 'valtio/react/utils'

describe('useProxy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should read and mutate with the same reference', async () => {
    const state = proxy({ count: 0 })

    const Counter = () => {
      const store = useProxy(state)
      return (
        <>
          <div>count: {store.count}</div>
          {/* eslint-disable-next-line react-hooks/immutability */}
          <button onClick={() => ++store.count}>increment</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('increment'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })

  it('should update nested object properties', async () => {
    const state = proxy({
      user: { name: 'Alice', age: 20 },
    })

    const Profile = () => {
      const store = useProxy(state)
      return (
        <>
          <div>
            {store.user.name} ({store.user.age})
          </div>
          {/* eslint-disable-next-line react-hooks/immutability */}
          <button onClick={() => (store.user.name = 'Bob')}>rename</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Profile />
      </StrictMode>,
    )

    expect(screen.getByText('Alice (20)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('rename'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Bob (20)')).toBeInTheDocument()
  })

  it('should handle multiple mutations in one handler', async () => {
    const state = proxy({ firstName: 'John', lastName: 'Doe' })

    const Form = () => {
      const store = useProxy(state)
      return (
        <>
          <div>
            {store.firstName} {store.lastName}
          </div>
          <button
            onClick={() => {
              // eslint-disable-next-line react-hooks/immutability
              store.firstName = 'Jane'
              store.lastName = 'Smith'
            }}
          >
            update
          </button>
        </>
      )
    }

    render(
      <StrictMode>
        <Form />
      </StrictMode>,
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()

    fireEvent.click(screen.getByText('update'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('should work with sync option', async () => {
    const state = proxy({ count: 0 })

    const Counter = () => {
      const store = useProxy(state, { sync: true })
      return (
        <>
          <div>count: {store.count}</div>
          {/* eslint-disable-next-line react-hooks/immutability */}
          <button onClick={() => ++store.count}>increment</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('increment'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
  })
})

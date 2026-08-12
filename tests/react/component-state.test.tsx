import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

// Behavior described in docs/guides/component-state.mdx
describe('component state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  type CounterState = { count: number }

  const MyContext = createContext<CounterState | null>(null)

  const MyProvider = ({ children }: { children: ReactNode }) => {
    const state = useRef(proxy<CounterState>({ count: 0 })).current
    return <MyContext.Provider value={state}>{children}</MyContext.Provider>
  }

  const MyCounter = ({ label }: { label: string }) => {
    const state = useContext(MyContext) as CounterState
    const snap = useSnapshot(state)
    return (
      <>
        <div>{`${label}: ${snap.count}`}</div>
        <button onClick={() => ++state.count}>{`${label} button`}</button>
      </>
    )
  }

  it('should isolate state per provider instance', async () => {
    render(
      <>
        <MyProvider>
          <MyCounter label="a" />
        </MyProvider>
        <MyProvider>
          <MyCounter label="b" />
        </MyProvider>
      </>,
    )

    expect(screen.getByText('a: 0')).toBeInTheDocument()
    expect(screen.getByText('b: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('a button'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('a: 1')).toBeInTheDocument()
    expect(screen.getByText('b: 0')).toBeInTheDocument()
  })

  it('should share state between siblings under one provider', async () => {
    render(
      <MyProvider>
        <MyCounter label="a" />
        <MyCounter label="b" />
      </MyProvider>,
    )

    fireEvent.click(screen.getByText('a button'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('a: 1')).toBeInTheDocument()
    expect(screen.getByText('b: 1')).toBeInTheDocument()
  })

  it('should keep the same proxy across re-renders', async () => {
    const seen: CounterState[] = []

    const Probe = () => {
      const state = useContext(MyContext) as CounterState
      const snap = useSnapshot(state)
      seen.push(state)
      return (
        <>
          <div>count: {snap.count}</div>
          <button onClick={() => ++state.count}>button</button>
        </>
      )
    }

    render(
      <MyProvider>
        <Probe />
      </MyProvider>,
    )

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
  })
})

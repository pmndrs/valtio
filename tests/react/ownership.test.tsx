import { Suspense, memo, startTransition, useState } from 'react'
// eslint-disable-next-line testing-library/no-manual-cleanup -- Release renderer roots before checking garbage collection.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LeakDetectorModule from 'jest-leak-detector'
import { describe, expect, it } from 'vitest'
import { proxy, snapshot } from 'valtio/vanilla'
import type { Snapshot } from 'valtio/vanilla'

const initialState = proxy({ child: { count: 1 } })
const initialSnapshot = snapshot(initialState)
const LeakDetector = (
  'default' in LeakDetectorModule
    ? LeakDetectorModule.default
    : LeakDetectorModule
) as typeof import('jest-leak-detector').default

describe('snapshot ownership', () => {
  it('should adopt snapshots created before loading the React binding', async () => {
    const { useSnapshot } = await import('valtio/react')
    const Component = () => {
      const tracked = useSnapshot(initialState, { sync: true })
      return <div>count: {tracked.child.count}</div>
    }
    render(<Component />)
    expect(screen.getByText('count: 1')).toBeInTheDocument()

    act(() => {
      initialState.child.count = 2
    })

    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(initialSnapshot.child.count).toBe(1)
  })

  it('should release live state after unmount while retaining a vanilla snapshot', async () => {
    const { useSnapshot } = await import('valtio/react')
    const observe = () => {
      const state = proxy({ child: { count: 1 } })
      const snap = snapshot(state)
      const detector = new LeakDetector(state)
      const childDetector = new LeakDetector(state.child)
      const Component = () => {
        const tracked = useSnapshot(state)
        return <div>{tracked.child.count}</div>
      }
      const { unmount } = render(<Component />)
      unmount()
      return { snap, detector, childDetector }
    }
    const { snap, detector, childDetector } = observe()
    cleanup()
    await Promise.resolve()

    expect(await detector.isLeaking()).toBe(false)
    expect(await childDetector.isLeaking()).toBe(false)
    expect(snap.child.count).toBe(1)
  })

  it('should recheck a replaced descendant first read from an older snapshot', async () => {
    const { useSnapshot } = await import('valtio/react')
    const state = proxy({ obj: { nested: { count: 1 } }, label: 'label' })
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: Snapshot<typeof state>
    }) {
      const [show, setShow] = useState(false)
      return (
        <>
          <button onClick={() => setShow(true)}>show</button>
          <div>{show ? tracked.obj.nested.count : 'hidden'}</div>
        </>
      )
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      return (
        <>
          <div>{tracked.label}</div>
          <Child tracked={tracked} />
        </>
      )
    }
    render(<Component />)
    await act(async () => {
      state.obj.nested = { count: 2 }
      snapshot(state)
    })
    expect(screen.getByText('hidden')).toBeInTheDocument()

    fireEvent.click(screen.getByText('show'))
    await act(() => Promise.resolve())

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('should recheck a newly bound child while an owner render is suspended', async () => {
    const { useSnapshot } = await import('valtio/react')
    const state = proxy({ child: { count: 1 } })
    const pending = new Promise<void>(() => {})
    const Child = memo(function Child({
      tracked,
    }: {
      tracked: Snapshot<typeof state>
    }) {
      const [show, setShow] = useState(false)
      return (
        <>
          <button onClick={() => setShow(true)}>show</button>
          <div>{show ? tracked.child.count : 'hidden'}</div>
        </>
      )
    })
    const Owner = ({ suspended }: { suspended: boolean }) => {
      const tracked = useSnapshot(state)
      if (suspended) {
        throw pending
      }
      return <Child tracked={tracked} />
    }
    const App = () => {
      const [suspended, setSuspended] = useState(false)
      return (
        <>
          <button onClick={() => startTransition(() => setSuspended(true))}>
            suspend
          </button>
          <Suspense fallback="loading">
            <Owner suspended={suspended} />
          </Suspense>
        </>
      )
    }
    render(<App />)
    fireEvent.click(screen.getByText('suspend'))
    await act(() => Promise.resolve())
    await act(async () => {
      state.child.count = 2
    })

    fireEvent.click(screen.getByText('show'))
    await act(() => Promise.resolve())

    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

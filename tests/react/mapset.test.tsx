import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { proxyMap, proxySet } from 'valtio/utils'

describe('mapset', () => {
  it('should not treat custom toStringTag values as collections', () => {
    const method = () => undefined
    const state = proxy({
      other: 0,
      method,
      get [Symbol.toStringTag]() {
        return 'Map'
      },
    })
    const renderFn = vi.fn()
    let snapshotMethod: (() => void) | undefined
    const Component = () => {
      const snap = useSnapshot(state, { sync: true })
      renderFn()
      snapshotMethod = snap.method
      return null
    }

    render(<Component />)
    expect(snapshotMethod).toBe(method)

    act(() => {
      state.other += 1
    })
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should track wrapped proxy collections', () => {
    const map = proxyMap([['first', 1]])
    const set = proxySet([1])
    const wrappedMap = proxy(proxy(map))
    const wrappedSet = proxy(proxy(set))

    const Component = () => {
      const mapSnap = useSnapshot(wrappedMap, { sync: true })
      const setSnap = useSnapshot(wrappedSet, { sync: true })
      return (
        <div>
          values: {mapSnap.size}, {String(mapSnap.has('second'))},{' '}
          {setSnap.size}, {String(setSnap.has(2))}
        </div>
      )
    }

    render(<Component />)
    expect(screen.getByText('values: 1, false, 1, false')).toBeInTheDocument()

    act(() => {
      map.set('second', 2)
      set.add(2)
    })
    expect(screen.getByText('values: 2, true, 2, true')).toBeInTheDocument()
  })

  it('unsupported map', async () => {
    const obj = proxy({ map: new Map([['count', 0]]) })

    const Counter = () => {
      const snap = useSnapshot(obj) as any
      return (
        <>
          <div>count: {snap.map.get('count')}</div>
          <button onClick={() => obj.map.set('count', 1)}>button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    expect(() => screen.getByText('count: 1')).toThrow()
  })

  it('unsupported set', async () => {
    const obj = proxy({ set: new Set([1, 2, 3]) })

    const Counter = () => {
      const snap = useSnapshot(obj) as any
      return (
        <>
          <div>count: {[...snap.set].join(',')}</div>
          <button onClick={() => obj.set.add(4)}>button</button>
        </>
      )
    }

    render(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(screen.getByText('count: 1,2,3')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    expect(() => screen.getByText('count: 1,2,3,4')).toThrow()
  })
})

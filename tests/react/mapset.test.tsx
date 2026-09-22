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
      const tracked = useSnapshot(state, { sync: true })
      renderFn()
      snapshotMethod = tracked.method
      return null
    }

    render(<Component />)
    expect(snapshotMethod).toBe(method)

    act(() => {
      state.other += 1
    })
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should use the snapshot collections as forEach receivers', () => {
    const state = proxy({
      map: proxyMap([['key', 'value']]),
      set: proxySet(['value']),
    })
    let mapMatches = false
    let setMatches = false
    let mapSnapshot: { has: (key: string) => boolean } | undefined
    let setSnapshot: { has: (value: string) => boolean } | undefined

    const Component = () => {
      const tracked = useSnapshot(state)
      mapSnapshot ||= tracked.map
      setSnapshot ||= tracked.set
      tracked.map.forEach((_value, _key, map) => {
        mapMatches = Object.is(map, tracked.map)
      })
      tracked.set.forEach((_value, _valueAgain, set) => {
        setMatches = Object.is(set, tracked.set)
      })
      return null
    }

    const { unmount } = render(<Component />)
    expect(mapMatches).toBe(true)
    expect(setMatches).toBe(true)

    unmount()
    state.map.set('next', 'value')
    state.set.add('next')
    expect(mapSnapshot?.has('next')).toBe(false)
    expect(setSnapshot?.has('next')).toBe(false)
  })

  it('should track wrapped proxy collections', () => {
    const map = proxyMap([['first', 1]])
    const set = proxySet([1])
    const wrappedMap = proxy(proxy(map))
    const wrappedSet = proxy(proxy(set))

    const Component = () => {
      const trackedMap = useSnapshot(wrappedMap, { sync: true })
      const trackedSet = useSnapshot(wrappedSet, { sync: true })
      return (
        <div>
          values: {trackedMap.size}, {String(trackedMap.has('second'))},{' '}
          {trackedSet.size}, {String(trackedSet.has(2))}
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

  it('should preserve wrapped collection snapshots', () => {
    const map = proxyMap([['first', 1]])
    const set = proxySet([1])
    const wrappedMap = proxy(map)
    const wrappedSet = proxy(set)
    let mapSnapshot: { has: (key: string) => boolean } | undefined
    let setSnapshot: { has: (value: number) => boolean } | undefined

    const Component = () => {
      mapSnapshot = useSnapshot(wrappedMap)
      setSnapshot = useSnapshot(wrappedSet)
      return null
    }

    const { unmount } = render(<Component />)
    unmount()
    map.set('second', 2)
    set.add(2)

    expect(mapSnapshot?.has('second')).toBe(false)
    expect(setSnapshot?.has(2)).toBe(false)
  })

  it('should preserve collection method receivers', () => {
    const state = proxyMap([['first', 1]])
    const snapshots: { has: typeof state.has }[] = []

    const Component = () => {
      const tracked = useSnapshot(state, { sync: true })
      snapshots.push(tracked)
      return <div>size: {tracked.size}</div>
    }

    render(<Component />)
    act(() => state.set('second', 2))

    expect(Reflect.apply(snapshots[0]!.has, snapshots[1], ['second'])).toBe(
      true,
    )
    expect(Reflect.apply(snapshots[1]!.has, snapshots[0], ['second'])).toBe(
      false,
    )
  })

  it('unsupported map', async () => {
    const obj = proxy({ map: new Map([['count', 0]]) })

    const Counter = () => {
      const tracked = useSnapshot(obj) as any
      return (
        <>
          <div>count: {tracked.map.get('count')}</div>
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
      const tracked = useSnapshot(obj) as any
      return (
        <>
          <div>count: {[...tracked.set].join(',')}</div>
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

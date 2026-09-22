import { Suspense, startTransition, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  proxy,
  ref,
  snapshot,
  trackKey,
  unstable_getInternalStates,
  unstable_replaceInternalFunction,
  useSnapshot,
} from 'valtio'
import { applyChanges, deepClone } from 'valtio/utils'
import { useCommitCount } from '../test-utils.js'

describe('optimization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not rerender if the leaf value does not change', async () => {
    const state = proxy({ nested: { count: 0 } })

    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return (
        <>
          <div>Count: {tracked.nested.count}</div>
          <button
            onClick={() => {
              applyChanges(state.nested, { count: 0 })
            }}
          >
            button-zero
          </button>
          <button
            onClick={() => {
              applyChanges(state.nested, { count: 1 })
            }}
          >
            button-one
          </button>
        </>
      )
    }

    render(<Component />)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('button-zero'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toBeCalledTimes(1)

    fireEvent.click(screen.getByText('button-one'))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
  })

  it('should allow independent writes to cloned snapshots assigned outside render', async () => {
    const source = proxy({ nested: { count: 0, other: 0 } })
    const destination = proxy<{ value?: typeof source.nested }>({})
    let nested!: typeof source.nested
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(source)
      nested = tracked.nested
      renderFn(tracked.nested.count)
      return null
    }

    render(<Component />)
    destination.value = deepClone(nested)
    destination.value.other = 1
    snapshot(destination)
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(source.nested.other).toBe(0)
    expect(nested.other).toBe(0)
    expect(snapshot(destination).value).toEqual({ count: 0, other: 1 })
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should clone nested snapshots before assigning them outside render', async () => {
    const source = proxy({ nested: { count: 0, other: 0 } })
    const destination = proxy<{
      value: { nested?: typeof source.nested }
    }>({ value: {} })
    let nested!: typeof source.nested
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(source)
      nested = tracked.nested
      renderFn(tracked.nested.count)
      return null
    }

    render(<Component />)
    destination.value = deepClone({ nested })
    destination.value.nested!.other = 1
    snapshot(destination)
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(source.nested.other).toBe(0)
    expect(nested.other).toBe(0)
    expect(snapshot(destination).value.nested).toEqual({ count: 0, other: 1 })
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should not rerender for deleting a non-own property', async () => {
    const base = Object.create({ inherited: 1 }) as {
      missing?: number
      inherited?: number
    }
    const state = proxy(base)
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return (
        <div>
          Values: {String(tracked.missing)}, {tracked.inherited}
        </div>
      )
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.missing
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.inherited
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should track an explicit proxy replacement without trackKey', async () => {
    const state = proxy({ nested: { count: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Count: {tracked.nested.count}</div>
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()

    state.nested = proxy({ count: 2 })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Count: 2')).toBeInTheDocument()
  })

  it('should track both a key and its accessed leaf with trackKey', async () => {
    const state = proxy({ nested: { count: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      const nested = trackKey(tracked, 'nested')
      renderFn()
      return <div>Count: {nested.count}</div>
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested = { count: 1 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()

    state.nested = proxy({ count: 2 })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Count: 2')).toBeInTheDocument()
  })

  it('should observe trackKey snapshot identity when filtering existence notifications', async () => {
    const state = proxy({ child: { count: 0 }, extra: 1 })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      trackKey(tracked, 'child')
      renderFn()
      return <div>extra: {String('extra' in tracked)}</div>
    }

    render(<Component />)
    const child = state.child
    state.child.count = 1
    state.extra = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(state.child).toBe(child)
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.child = proxy({ count: 1 })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)

    child.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should track references alongside getter dependencies', async () => {
    const state = proxy({
      child: { count: 0 },
      get parity() {
        return this.child.count % 2
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      trackKey(tracked, 'child')
      renderFn()
      return <div>parity: {tracked.parity}</div>
    }

    render(<Component />)
    state.child.count = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.child = proxy({ count: 2 })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)

    state.child.count = 3
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('parity: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(4)
  })

  it('should preserve ref snapshot identity when comparing trackKey values', async () => {
    const source = proxy({ count: 0 })
    const state = proxy({ child: ref(snapshot(source)) })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      const child = trackKey(tracked, 'child')
      renderFn()
      return <div>count: {child.count}</div>
    }

    render(<Component />)
    source.count = 1
    state.child = ref(snapshot(source))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should update subscriptions when accessed keys change', async () => {
    const state = proxy({ useA: true, a: 0, b: 0 })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Count: {tracked.useA ? tracked.a : tracked.b}</div>
    }

    render(<Component />)
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.useA = false
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should retain keys accessed before a prop change', async () => {
    const state = proxy({ a: 0, b: 0 })
    const renderFn = vi.fn()
    const Component = ({ useA }: { useA: boolean }) => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Count: {useA ? tracked.a : tracked.b}</div>
    }

    const { rerender } = render(<Component useA />)
    rerender(<Component useA={false} />)
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(3)

    state.b += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(4)
  })

  it('should detect a new-key mutation before passive subscription', async () => {
    const state = proxy({ a: 0, b: 0 })
    const Component = ({ useA }: { useA: boolean }) => {
      const tracked = useSnapshot(state)
      useLayoutEffect(() => {
        if (!useA) {
          state.b += 1
        }
      }, [useA])
      return <div>Count: {useA ? tracked.a : tracked.b}</div>
    }

    const { rerender } = render(<Component useA />)
    rerender(<Component useA={false} />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it.each([
    { nested: false, sync: false },
    { nested: true, sync: false },
    { nested: false, sync: true },
    { nested: true, sync: true },
  ])(
    'should ignore unread layout-effect changes (nested: $nested, sync: $sync)',
    async ({ nested, sync }) => {
      const state = proxy({ count: 0, nested: { count: 0 }, other: 0 })
      const renderFn = vi.fn()
      const Component = () => {
        const tracked = useSnapshot(state, { sync })
        renderFn()
        useLayoutEffect(() => {
          state.other += 1
        })
        return <div>Count: {nested ? tracked.nested.count : tracked.count}</div>
      }

      render(<Component />)
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(screen.getByText('Count: 0')).toBeInTheDocument()
      expect(renderFn).toHaveBeenCalledTimes(1)

      const counter = nested ? state.nested : state
      await act(async () => {
        counter.count = 1
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('Count: 1')).toBeInTheDocument()
      expect(renderFn).toHaveBeenCalledTimes(2)
    },
  )

  it('should replay indexed snapshot usage in linear work per render', () => {
    const countReads = (length: number) => {
      const state = proxy({
        items: Array.from({ length }, (_, id) => ({ id })),
      })
      const counts: number[] = []
      const Component = () => {
        const tracked = useSnapshot(state)
        const get = vi.spyOn(Map.prototype, 'get')
        let total = 0
        try {
          for (let index = 0; index < length; index += 1) {
            total += tracked.items[index]!.id
          }
          counts.push(get.mock.calls.length)
        } finally {
          get.mockRestore()
        }
        return <div>Total: {total}</div>
      }
      const { rerender, unmount } = render(<Component />)
      rerender(<Component />)
      unmount()
      return counts
    }

    const small = countReads(20)
    const large = countReads(80)
    expect(large).toHaveLength(2)
    large.forEach((count, index) => {
      expect(count).toBeLessThan(small[index]! * 5)
    })
  })

  it('should update subscriptions when the root proxy changes', async () => {
    const first = proxy({ count: 0 })
    const second = proxy({ count: 0 })
    const renderFn = vi.fn()
    const Component = ({ state }: { state: { count: number } }) => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Count: {tracked.count}</div>
    }

    const { rerender } = render(<Component state={first} />)
    rerender(<Component state={second} />)
    expect(renderFn).toHaveBeenCalledTimes(2)

    first.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(2)

    second.count += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should not retain subscriptions to previous root proxies', () => {
    const states = [
      proxy({ count: 0 }),
      proxy({ count: 0 }),
      proxy({ count: 0 }),
    ]
    const { proxyStateMap } = unstable_getInternalStates()
    const addKeyListeners = states.map((state) => {
      const proxyState = proxyStateMap.get(state)!
      const [, , , addKeyListener] = proxyState
      const addKeyListenerMock = vi.fn(addKeyListener)
      const mutableProxyState = proxyState as unknown as [
        unknown,
        unknown,
        unknown,
        typeof addKeyListener,
      ]
      mutableProxyState[3] = addKeyListenerMock
      return addKeyListenerMock
    })
    const Component = ({ state }: { state: { count: number } }) => {
      const tracked = useSnapshot(state)
      return <div>Count: {tracked.count}</div>
    }

    const { rerender } = render(<Component state={states[0]!} />)
    rerender(<Component state={states[1]!} />)
    rerender(<Component state={states[2]!} />)

    expect(
      addKeyListeners.map((listener) => listener.mock.calls.length),
    ).toEqual([1, 1, 1])
  })

  it('should share getter subscription baselines', () => {
    const items = Array.from({ length: 4 }, (_, value) => proxy({ value }))
    const state = proxy({
      items,
      get total() {
        return this.items.reduce((total, item) => total + item.value, 0)
      },
    })
    const { proxyStateMap } = unstable_getInternalStates()
    const targets = items.map((item) => proxyStateMap.get(item)![0])
    const calls = new Map(targets.map((target) => [target, 0]))
    let original: any
    unstable_replaceInternalFunction('createSnapshot', (prev) => {
      original = prev
      return (target, version) => {
        if (calls.has(target)) {
          calls.set(target, calls.get(target)! + 1)
        }
        return prev(target, version)
      }
    })

    try {
      const Component = () => {
        const tracked = useSnapshot(state)
        return <div>Total: {tracked.total}</div>
      }
      render(<Component />)
      expect(targets.map((target) => calls.get(target))).toEqual([2, 2, 2, 2])
    } finally {
      unstable_replaceInternalFunction('createSnapshot', () => original)
    }
  })

  it('should batch getter dependency changes without comparing getter results', async () => {
    const items = Array.from({ length: 4 }, () => proxy({ count: 0 }))
    const state = proxy({
      items,
      get parity() {
        return this.items.reduce((total, item) => total + item.count, 0) % 2
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Parity: {tracked.parity}</div>
    }
    render(<Component />)

    const { proxyStateMap } = unstable_getInternalStates()
    const targets = items.map((item) => proxyStateMap.get(item)![0])
    const calls = new Map(targets.map((target) => [target, 0]))
    let original: any
    unstable_replaceInternalFunction('createSnapshot', (prev) => {
      original = prev
      return (target, version) => {
        if (calls.has(target)) {
          calls.set(target, calls.get(target)! + 1)
        }
        return prev(target, version)
      }
    })

    try {
      items.forEach((item) => {
        item.count += 2
      })
      await act(() => vi.advanceTimersByTimeAsync(0))

      expect(renderFn).toHaveBeenCalledTimes(2)
      expect(targets.map((target) => calls.get(target))).toEqual([4, 2, 2, 2])
    } finally {
      unstable_replaceInternalFunction('createSnapshot', () => original)
    }
  })

  it('should keep committed subscriptions during a suspended render', async () => {
    const state = proxy({ a: 0, b: 0 })
    const promise = new Promise<void>(() => {})
    const Component = ({ useA }: { useA: boolean }) => {
      const tracked = useSnapshot(state)
      if (!useA) {
        void tracked.b
        throw promise
      }
      return <div>Count: {tracked.a}</div>
    }
    const App = () => {
      const [useA, setUseA] = useState(true)
      return (
        <>
          <button onClick={() => startTransition(() => setUseA(false))}>
            switch
          </button>
          <Suspense fallback="loading">
            <Component useA={useA} />
          </Suspense>
        </>
      )
    }

    render(<App />)
    fireEvent.click(screen.getByText('switch'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 0')).toBeInTheDocument()

    state.a += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('should grow committed subscriptions during a suspended render', async () => {
    const state = proxy({ a: 0, b: 0 })
    const promise = new Promise<void>(() => {})
    const Child = ({ tracked }: { tracked: typeof state }) => {
      const [useB, setUseB] = useState(false)
      return (
        <>
          <button onClick={() => setUseB(true)}>use b</button>
          <div>Count: {useB ? tracked.b : tracked.a}</div>
        </>
      )
    }
    const Component = ({ suspend }: { suspend: boolean }) => {
      const tracked = useSnapshot(state)
      if (suspend) {
        throw promise
      }
      return <Child tracked={tracked} />
    }
    const App = () => {
      const [suspend, setSuspend] = useState(false)
      return (
        <>
          <button onClick={() => startTransition(() => setSuspend(true))}>
            suspend
          </button>
          <Suspense fallback="loading">
            <Component suspend={suspend} />
          </Suspense>
        </>
      )
    }

    render(<App />)
    fireEvent.click(screen.getByText('suspend'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    fireEvent.click(screen.getByText('use b'))
    expect(screen.getByText('Count: 0')).toBeInTheDocument()

    state.b = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })

  it('should track property existence with the in operator', async () => {
    const state = proxy<{ value?: number; other: number }>({
      value: 1,
      other: 0,
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Value: {'value' in tracked ? 'present' : 'absent'}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.other += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: absent')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should track own-property checks', async () => {
    const state = proxy<{ value?: number; other: number }>({
      value: 1,
      other: 0,
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return (
        <div>
          Value:{' '}
          {Object.prototype.hasOwnProperty.call(tracked, 'value')
            ? 'present'
            : 'absent'}
        </div>
      )
    }

    render(<Component />)
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.other += 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    delete state.value
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: absent')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.value = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: present')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should track property enumeration', async () => {
    const state = proxy<{
      first?: number
      second?: number
      nested: { count: number }
    }>({ first: 1, nested: { count: 0 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Keys: {Object.keys(tracked).join(',')}</div>
    }

    render(<Component />)
    expect(screen.getByText('Keys: first,nested')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.first = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested.count = 1
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.second = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: first,nested,second')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    delete state.first
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: nested,second')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it.each([false, true])(
    'should track enumeration after re-adding a non-enumerable key (getter: %s)',
    async (useGetter) => {
      const child: { value?: number } = {}
      Object.defineProperty(child, 'value', {
        value: 1,
        writable: true,
        configurable: true,
      })
      const state = proxy({
        child,
        get keys() {
          return Object.keys(this.child).join(',')
        },
      })
      const renderFn = vi.fn()
      const Component = () => {
        const tracked = useSnapshot(state)
        renderFn()
        const keys = useGetter
          ? tracked.keys
          : Object.keys(tracked.child).join(',')
        return <div>Keys: {keys || 'none'}</div>
      }

      render(<Component />)
      expect(screen.getByText('Keys: none')).toBeInTheDocument()

      delete state.child.value
      state.child.value = 1
      await act(() => vi.advanceTimersByTimeAsync(0))

      expect(screen.getByText('Keys: value')).toBeInTheDocument()
      expect(renderFn).toHaveBeenCalledTimes(2)
    },
  )

  it('should rerender when replacement changes key order', async () => {
    const state = proxy({ nested: { a: 1, b: 2 } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Keys: {Object.keys(tracked.nested).join(',')}</div>
    }

    render(<Component />)
    expect(screen.getByText('Keys: a,b')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.nested = { b: 2, a: 1 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Keys: b,a')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should track object spread', async () => {
    const state = proxy<{ first?: number; second?: number }>({ first: 1 })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Value: {JSON.stringify({ ...tracked })}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: {"first":1}')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    state.first = 2
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: {"first":2}')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    state.second = 3
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(
      screen.getByText('Value: {"first":2,"second":3}'),
    ).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should rerender when raw assignment adds or deletes an accessed leaf', async () => {
    const state = proxy<{
      nested: { value?: number; other: number }
    }>({ nested: { value: 1, other: 0 } })
    const nested = state.nested
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Value: {tracked.nested.value ?? 'missing'}</div>
    }

    render(<Component />)
    expect(screen.getByText('Value: 1')).toBeInTheDocument()

    state.nested = { other: 0 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: missing')).toBeInTheDocument()
    expect(state.nested).not.toBe(nested)

    state.nested = { value: 2, other: 0 }
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Value: 2')).toBeInTheDocument()
    expect(state.nested).not.toBe(nested)
    expect(renderFn).toHaveBeenCalledTimes(3)
  })

  it('should follow shared children after replacement', async () => {
    const state = proxy({
      root: { a: { count: 0 }, b: { count: 1 } },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>Count: {tracked.root.b.count}</div>
    }

    render(<Component />)
    expect(screen.getByText('Count: 1')).toBeInTheDocument()

    const shared = { count: 2 }
    state.root = { a: shared, b: shared }
    await act(() => vi.advanceTimersByTimeAsync(0))

    expect(screen.getByText('Count: 2')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
    expect(state.root.a).toBe(state.root.b)
  })

  it('regression: useSnapshot renders should not fail consistency check with extra render (nested useSnapshot)', async () => {
    const obj = proxy({ childCount: 0, parentCount: 0 })

    const childRenderFn = vi.fn()
    const Child = () => {
      const tracked = useSnapshot(obj)
      childRenderFn(tracked.childCount)
      return (
        <>
          <div>childCount: {tracked.childCount}</div>
          <button onClick={() => ++obj.childCount}>childButton</button>
        </>
      )
    }

    const parentRenderFn = vi.fn()
    const Parent = () => {
      const tracked = useSnapshot(obj)
      parentRenderFn(tracked.parentCount)
      return (
        <>
          <div>parentCount: {tracked.parentCount}</div>
          <button onClick={() => ++obj.parentCount}>parentButton</button>
          <Child />
        </>
      )
    }

    render(<Parent />)

    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 0')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(1)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(1)
    expect(parentRenderFn).lastCalledWith(0)

    obj.parentCount += 1

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 1')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(2)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(2)
    expect(parentRenderFn).lastCalledWith(1)
  })

  it('regression: useSnapshot renders should not fail consistency check with extra render', async () => {
    const obj = proxy({ childCount: 0, anotherValue: 0 })

    const childRenderFn = vi.fn()
    const Child = () => {
      const tracked = useSnapshot(obj)
      childRenderFn(tracked.childCount)
      return (
        <>
          <div>childCount: {tracked.childCount}</div>
          <button onClick={() => ++obj.childCount}>childButton</button>
        </>
      )
    }

    const parentRenderFn = vi.fn()
    const Parent = () => {
      const [parentCount, setParentCount] = useState(0)

      parentRenderFn(parentCount)

      return (
        <>
          <div>parentCount: {parentCount}</div>
          <button onClick={() => setParentCount((v) => v + 1)}>
            parentButton
          </button>
          <Child />
        </>
      )
    }

    render(<Parent />)

    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 0')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(1)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(1)
    expect(parentRenderFn).lastCalledWith(0)

    obj.anotherValue += 1

    fireEvent.click(screen.getByText('parentButton'))
    expect(screen.getByText('childCount: 0')).toBeInTheDocument()
    expect(screen.getByText('parentCount: 1')).toBeInTheDocument()

    expect(childRenderFn).toBeCalledTimes(2)
    expect(childRenderFn).lastCalledWith(0)
    expect(parentRenderFn).toBeCalledTimes(2)
    expect(parentRenderFn).lastCalledWith(1)
  })

  it('no extra re-renders (commits)', async () => {
    const obj = proxy({ count: 0, count2: 0 })

    const Counter = () => {
      const tracked = useSnapshot(obj)
      return (
        <>
          <div>
            count: {tracked.count} ({useCommitCount(1)})
          </div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const Counter2 = () => {
      const tracked = useSnapshot(obj)
      return (
        <>
          <div>
            count2: {tracked.count2} ({useCommitCount(1)})
          </div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0 (1)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 0 (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1 (2)')).toBeInTheDocument()
    expect(screen.getByText('count2: 1 (2)')).toBeInTheDocument()
  })

  it('no extra re-renders (render func calls in non strict mode)', async () => {
    const obj = proxy({ count: 0, count2: 0 })

    const renderFn = vi.fn()
    const Counter = () => {
      const tracked = useSnapshot(obj)
      renderFn(tracked.count)
      return (
        <>
          <div>count: {tracked.count}</div>
          <button onClick={() => ++obj.count}>button</button>
        </>
      )
    }

    const renderFn2 = vi.fn()
    const Counter2 = () => {
      const tracked = useSnapshot(obj)
      renderFn2(tracked.count2)
      return (
        <>
          <div>count2: {tracked.count2}</div>
          <button onClick={() => ++obj.count2}>button2</button>
        </>
      )
    }

    render(
      <>
        <Counter />
        <Counter2 />
      </>,
    )

    expect(screen.getByText('count: 0')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(1)
    expect(renderFn).lastCalledWith(0)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 0')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(1)
    expect(renderFn2).lastCalledWith(0)

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 1')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(2)
    expect(renderFn2).lastCalledWith(1)

    fireEvent.click(screen.getByText('button2'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(2)
    expect(renderFn).lastCalledWith(1)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)

    fireEvent.click(screen.getByText('button'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('count: 2')).toBeInTheDocument()
    expect(screen.getByText('count2: 2')).toBeInTheDocument()
    expect(renderFn).toBeCalledTimes(3)
    expect(renderFn).lastCalledWith(2)
    expect(renderFn2).toBeCalledTimes(3)
    expect(renderFn2).lastCalledWith(2)
  })
})

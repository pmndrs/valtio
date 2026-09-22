import { memo, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'
import type { Snapshot } from 'valtio'
import { proxyMap } from 'valtio/utils'

describe('replacement and detachment', () => {
  it.each([false, true])(
    'should follow replacement above a non-writable proxy child (sync: %s)',
    async (sync) => {
      const child = proxy({ count: 0 })
      const node = { child }
      Object.defineProperty(node, 'child', { writable: false })
      const state = proxy({ node })
      const Component = () => {
        const tracked = useSnapshot(state, { sync })
        return <div>count: {tracked.node.child.count}</div>
      }

      render(<Component />)
      expect(screen.getByText('count: 0')).toBeInTheDocument()
      await act(async () => {
        state.node = { child: { count: 1 } }
      })

      expect(screen.getByText('count: 1')).toBeInTheDocument()
      expect(child.count).toBe(0)
      await act(async () => {
        state.node.child.count = 2
      })
      expect(screen.getByText('count: 2')).toBeInTheDocument()
    },
  )

  it('catches replacement between render and subscription', async () => {
    const state = proxy({ obj: { count: 1 } })
    const Component = () => {
      const tracked = useSnapshot(state)
      useLayoutEffect(() => {
        state.obj = { count: 2 }
      }, [])
      return <div>{tracked.obj.count}</div>
    }
    render(<Component />)
    await act(() => Promise.resolve())
    expect(screen.getByText('2')).toBeInTheDocument()
  })
  it('replaces objects and follows deep leaves across equal replacements', async () => {
    const state = proxy({ obj: { nested: { count: 1 } } })
    const previous = state.obj
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>{tracked.obj.nested.count}</div>
    }
    render(<Component />)
    await act(async () => {
      state.obj = { nested: { count: 4 } }
    })
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(previous.nested.count).toBe(1)
    expect(state.obj).not.toBe(previous)
    await act(async () => {
      state.obj = { nested: { count: 4 } }
    })
    expect(renderFn).toHaveBeenCalledTimes(3)
    await act(async () => {
      previous.nested.count = 9
    })
    expect(renderFn).toHaveBeenCalledTimes(3)
    await act(async () => {
      state.obj.nested.count = 5
    })
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it.each(['delete', 'null', 'truncate'] as const)(
    'notifies deep reads on %s',
    async (operation) => {
      const state = proxy<{ items: { nested: { count: number } }[] | null }>({
        items: [{ nested: { count: 1 } }],
      })
      const Component = () => {
        const tracked = useSnapshot(state)
        return <div>{tracked.items?.[0]?.nested.count ?? 'missing'}</div>
      }
      render(<Component />)
      await act(async () => {
        if (operation === 'null') state.items = null
        else if (operation === 'truncate') state.items!.length = 0
        else delete state.items![0]
      })
      expect(screen.getByText('missing')).toBeInTheDocument()
    },
  )

  it('invalidates shared descendants without mutating retained aliases', async () => {
    const shared = proxy({ count: 1 })
    const state = proxy({ left: { child: shared }, right: shared })
    const Component = () => {
      const tracked = useSnapshot(state)
      return (
        <div>
          {tracked.left.child.count}/{tracked.right.count}
        </div>
      )
    }
    render(<Component />)
    await act(async () => {
      state.left = { child: { count: 4 } }
    })
    expect(screen.getByText('4/1')).toBeInTheDocument()
    expect(shared.count).toBe(1)
    await act(async () => {
      shared.count = 2
    })
    expect(screen.getByText('4/2')).toBeInTheDocument()
  })

  it('handles cycles without inventing changes to the old snapshot', async () => {
    type Node = { count: number; self?: Node }
    const child: Node = { count: 1 }
    child.self = child
    const state = proxy({ child })
    const previous = state.child
    const previousSnapshot = snapshot(previous)
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.child.self?.count ?? tracked.child.count}</div>
    }
    render(<Component />)
    await act(async () => {
      state.child = { count: 2 }
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(snapshot(previous)).toBe(previousSnapshot)
    expect(previous.self).toBe(previous)
  })

  it('keeps old immutable snapshots readable after replacement', async () => {
    const state = proxy({ obj: { count: 1 } })
    let previous: Snapshot<typeof state> | undefined
    const Component = () => {
      const tracked = useSnapshot(state)
      previous ||= tracked
      return <div>{tracked.obj.count}</div>
    }
    render(<Component />)
    await act(async () => {
      state.obj = { count: 2 }
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(previous!.obj.count).toBe(1)
  })

  it('keeps detached hooks bound to their own proxy', async () => {
    const state = proxy({ obj: { count: 1 } })
    const previous = state.obj
    const Child = () => {
      const tracked = useSnapshot(previous)
      return <div>child:{tracked.count}</div>
    }
    const Parent = () => {
      const tracked = useSnapshot(state)
      return (
        <>
          <div>parent:{tracked.obj.count}</div>
          <Child />
        </>
      )
    }
    render(<Parent />)
    await act(async () => {
      state.obj = { count: 2 }
    })
    expect(screen.getByText('parent:2')).toBeInTheDocument()
    expect(screen.getByText('child:1')).toBeInTheDocument()
    await act(async () => {
      previous.count = 3
    })
    expect(screen.getByText('child:3')).toBeInTheDocument()
  })

  it('notifies existing key subscribers after the replacement is installed', () => {
    const state = proxy({ obj: { nested: { count: 1 } } })
    const previous = state.obj
    const handler = vi.fn(() => {
      expect(state.obj.nested.count).toBe(2)
      expect(previous.nested.count).toBe(1)
    })
    const remove = subscribe(previous.nested, handler, {
      keys: ['count'],
      sync: true,
    })
    state.obj = { nested: { count: 2 } }
    expect(handler).toHaveBeenCalledTimes(1)
    remove()
  })

  it('does not traverse refs when their parent is replaced', () => {
    const inner = proxy({ count: 1 })
    const state = proxy({ obj: { inner: ref(inner) } })
    const handler = vi.fn()
    const remove = subscribe(inner, handler, { keys: ['count'], sync: true })
    state.obj = { inner: ref(proxy({ count: 2 })) }
    expect(handler).not.toHaveBeenCalled()
    remove()
  })

  it('rechecks late descendant reads after their old subtree was detached', async () => {
    const state = proxy({ obj: { count: 1 } })
    const Child = memo(function Child({
      obj,
    }: {
      obj: { readonly count: number }
    }) {
      const [show, setShow] = useState(false)
      return (
        <>
          <button onClick={() => setShow(true)}>show</button>
          <div>{show ? obj.count : 'hidden'}</div>
        </>
      )
    })
    const Parent = () => {
      const tracked = useSnapshot(state)
      return <Child obj={tracked.obj} />
    }
    render(<Parent />)
    await act(async () => {
      state.obj = { count: 2 }
    })
    fireEvent.click(screen.getByText('show'))
    await act(() => Promise.resolve())
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('getters with replacement', () => {
  it('tracks a getter hosted inside the detached child', async () => {
    const makeChild = (count: number) => ({
      count,
      get doubled() {
        return this.count * 2
      },
    })
    const state = proxy({ child: makeChild(1) })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.child.doubled}</div>
    }
    render(<Component />)
    await act(async () => {
      state.child = makeChild(2)
    })
    expect(screen.getByText('4')).toBeInTheDocument()
    await act(async () => {
      state.child.count = 3
    })
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('refreshes dynamic getter dependencies after an equal replacement', async () => {
    const state = proxy({
      child: { useA: true, a: 1, b: 1 },
      get selected() {
        return this.child.useA ? this.child.a : this.child.b
      },
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.selected}</div>
    }
    render(<Component />)
    await act(async () => {
      state.child = { useA: false, a: 1, b: 1 }
    })
    await act(async () => {
      state.child.b = 2
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('follows getter-created result containers across array replacement', async () => {
    const state = proxy({
      items: [{ active: true, label: 'old' }],
      get filtered() {
        return this.items.filter((item) => item.active)
      },
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.filtered.map((item) => item.label).join(',')}</div>
    }
    render(<Component />)
    await act(async () => {
      state.items = [{ active: true, label: 'new' }]
    })
    expect(screen.getByText('new')).toBeInTheDocument()
    await act(async () => {
      state.items[0]!.label = 'newest'
    })
    expect(screen.getByText('newest')).toBeInTheDocument()
  })

  it('renders updated getter-returned closure values after replacement', async () => {
    // In v2, function identity alone can trigger this render.
    const state = proxy({
      obj: { count: 1 },
      get select() {
        return () => this.obj.count
      },
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.select()}</div>
    }
    render(<Component />)
    expect(screen.getByText('1')).toBeInTheDocument()
    await act(async () => {
      state.obj = { count: 2 }
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not eagerly evaluate getters while detaching a subtree', () => {
    const evaluate = vi.fn(() => {
      throw new Error('must not run')
    })
    const state = proxy({
      obj: {
        count: 1,
        get computed(): number {
          return evaluate()
        },
      },
    })
    const remove = subscribe(state.obj, () => {}, {
      keys: ['count'],
      sync: true,
    })
    expect(() => {
      state.obj = {
        count: 2,
        get computed() {
          return 2
        },
      }
    }).not.toThrow()
    expect(evaluate).not.toHaveBeenCalled()
    remove()
  })

  it('supports collection-backed getters when collections are replaced', async () => {
    const state = proxy({
      items: proxyMap([['key', { count: 1 }]]),
      get selected() {
        return this.items.get('key')!.count
      },
    })
    const Component = () => {
      const tracked = useSnapshot(state)
      return <div>{tracked.selected}</div>
    }
    render(<Component />)
    await act(async () => {
      state.items = proxyMap([['key', { count: 2 }]])
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    await act(async () => {
      state.items.get('key')!.count = 3
    })
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

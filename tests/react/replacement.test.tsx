import { memo, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { proxy, snapshot, useSnapshot } from 'valtio'
import type { Snapshot } from 'valtio'
import { proxyMap } from 'valtio/utils'

describe('replacement and detachment', () => {
  it('catches replacement between render and subscription', async () => {
    const state = proxy({ obj: { count: 1 } })
    const Component = () => {
      const snap = useSnapshot(state)
      useLayoutEffect(() => {
        state.obj = { count: 2 }
      }, [])
      return <div>{snap.obj.count}</div>
    }
    render(<Component />)
    await act(() => Promise.resolve())
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it.each(['delete', 'null', 'truncate'] as const)(
    'notifies deep reads on %s',
    async (operation) => {
      const state = proxy<{ items: { nested: { count: number } }[] | null }>({
        items: [{ nested: { count: 1 } }],
      })
      const Component = () => {
        const snap = useSnapshot(state)
        return <div>{snap.items?.[0]?.nested.count ?? 'missing'}</div>
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
      const snap = useSnapshot(state)
      return (
        <div>
          {snap.left.child.count}/{snap.right.count}
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
      const snap = useSnapshot(state)
      return <div>{snap.child.self?.count ?? snap.child.count}</div>
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
      const snap = useSnapshot(state)
      previous ||= snap
      return <div>{snap.obj.count}</div>
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
      const snap = useSnapshot(previous)
      return <div>child:{snap.count}</div>
    }
    const Parent = () => {
      const snap = useSnapshot(state)
      return (
        <>
          <div>parent:{snap.obj.count}</div>
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
      const snap = useSnapshot(state)
      return <Child obj={snap.obj} />
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
      const snap = useSnapshot(state)
      return <div>{snap.child.doubled}</div>
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
      const snap = useSnapshot(state)
      return <div>{snap.selected}</div>
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

  it('renders updated getter-returned closure values after replacement', async () => {
    // In v2, function identity alone can trigger this render.
    const state = proxy({
      obj: { count: 1 },
      get select() {
        return () => this.obj.count
      },
    })
    const Component = () => {
      const snap = useSnapshot(state)
      return <div>{snap.select()}</div>
    }
    render(<Component />)
    expect(screen.getByText('1')).toBeInTheDocument()
    await act(async () => {
      state.obj = { count: 2 }
    })
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('supports collection-backed getters when collections are replaced', async () => {
    const state = proxy({
      items: proxyMap([['key', { count: 1 }]]),
      get selected() {
        return this.items.get('key')!.count
      },
    })
    const Component = () => {
      const snap = useSnapshot(state)
      return <div>{snap.selected}</div>
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

import { memo, useLayoutEffect, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { memoize } from 'proxy-memoize'
import { describe, expect, it, vi } from 'vitest'
import { proxy, ref, snapshot, useSnapshot } from 'valtio'

describe('getter results', () => {
  it.each([false, true])(
    'should notify direct accessor assignments (sync: %s)',
    async (sync) => {
      const state = proxy({
        date: new Date(0),
        get timestamp() {
          return this.date.getTime()
        },
        set timestamp(value: number) {
          this.date.setTime(value)
        },
      })
      const Component = () => {
        const snap = useSnapshot(state, { sync })
        return <div>time: {snap.timestamp}</div>
      }

      render(<Component />)
      expect(screen.getByText('time: 0')).toBeInTheDocument()
      await act(async () => {
        state.timestamp = 1000
      })
      expect(screen.getByText('time: 1000')).toBeInTheDocument()
    },
  )

  it('should detect an accessor assignment before subscribing', async () => {
    const state = proxy({
      date: new Date(0),
      get timestamp() {
        return this.date.getTime()
      },
      set timestamp(value: number) {
        this.date.setTime(value)
      },
    })
    const Component = () => {
      const snap = useSnapshot(state)
      useLayoutEffect(() => {
        state.timestamp = 1000
      }, [])
      return <div>time: {snap.timestamp}</div>
    }

    render(<Component />)
    await act(() => Promise.resolve())
    expect(screen.getByText('time: 1000')).toBeInTheDocument()
  })

  it('should ignore layout-effect writes to unread accessors', () => {
    const state = proxy({
      date: new Date(0),
      otherDate: new Date(0),
      get timestamp() {
        return this.date.getTime()
      },
      set timestamp(value: number) {
        this.date.setTime(value)
      },
      get otherTimestamp() {
        return this.otherDate.getTime()
      },
      set otherTimestamp(value: number) {
        this.otherDate.setTime(value)
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      useLayoutEffect(() => {
        state.otherTimestamp++
      })
      return <div>time: {snap.timestamp}</div>
    }

    render(<Component />)
    expect(screen.getByText('time: 0')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('should track filtered item fields and membership', async () => {
    const state = proxy({
      items: [
        { active: true, label: 'old' },
        { active: false, label: 'hidden' },
      ],
      get filtered() {
        return this.items.filter((item) => item.active)
      },
    })
    const renderFn = vi.fn()
    const Component = () => {
      const snap = useSnapshot(state)
      renderFn()
      return <div>{snap.filtered.map((item) => item.label).join(',')}</div>
    }

    render(<Component />)
    await act(async () => {
      state.items[0] = { active: true, label: 'new' }
    })
    expect(screen.getByText('new')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    await act(async () => {
      state.items[1]!.label = 'renamed'
    })
    expect(renderFn).toHaveBeenCalledTimes(2)

    await act(async () => {
      state.items[1]!.active = true
    })
    expect(screen.getByText('new,renamed')).toBeInTheDocument()
  })

  it('should track late reads from getter containers in memoized children', async () => {
    const state = proxy({
      child: { label: 'old' },
      get view() {
        return { child: this.child }
      },
    })
    const Child = memo(function Child({
      child,
    }: {
      child: { readonly label: string }
    }) {
      const [show, setShow] = useState(false)
      return (
        <>
          <button onClick={() => setShow(true)}>show</button>
          <div>{show ? child.label : 'hidden'}</div>
        </>
      )
    })
    const Parent = () => {
      const snap = useSnapshot(state)
      return <Child child={snap.view.child} />
    }

    render(<Parent />)
    await act(async () => {
      state.child.label = 'new'
    })
    fireEvent.click(screen.getByText('show'))
    await act(() => Promise.resolve())
    expect(screen.getByText('new')).toBeInTheDocument()
  })

  it('should preserve refs returned in getter containers', () => {
    const child = ref({ label: 'ref' })
    const state = proxy({
      child,
      get view() {
        return { child: this.child }
      },
    })
    const Component = () => {
      const snap = useSnapshot(state)
      expect(snap.view.child).toBe(child)
      return <div>{snap.view.child.label}</div>
    }

    render(<Component />)
    expect(screen.getByText('ref')).toBeInTheDocument()
  })

  it('should retain descendant reads from a getter returning a descriptor value', async () => {
    const state = proxy({
      child: { label: 'old' },
      get selected(): { label: string } {
        return Object.getOwnPropertyDescriptor(this, 'child')!.value
      },
    })
    const childRender = vi.fn()
    const Child = memo(function Child({
      snap,
    }: {
      snap: { readonly selected: { readonly label: string } }
    }) {
      childRender()
      return <div>{snap.selected.label}</div>
    })
    const Parent = () => {
      const [, rerender] = useState(0)
      const snap = useSnapshot(state)
      return (
        <>
          <button onClick={() => rerender((value) => value + 1)}>parent</button>
          <Child snap={snap} />
        </>
      )
    }

    render(<Parent />)
    fireEvent.click(screen.getByText('parent'))
    expect(childRender).toHaveBeenCalledTimes(1)
    await act(async () => {
      state.child.label = 'new'
    })
    expect(screen.getByText('new')).toBeInTheDocument()
  })

  it('should memoize explicit immutable inputs without losing subscriptions', async () => {
    const compute = vi.fn((input: { count: number }) => ({
      isEven: input.count % 2 === 0,
    }))
    const getInfo = memoize(compute)
    const state = proxy({
      count: 0,
      get info() {
        return getInfo({ count: this.count })
      },
    })
    const initial = state.info
    const Component = () => {
      const snap = useSnapshot(state)
      return <div>even: {String(snap.info.isEven)}</div>
    }

    render(
      <>
        <Component />
        <Component />
      </>,
    )
    expect(compute).toHaveBeenCalledTimes(1)
    expect(snapshot(state).info).toBe(initial)

    await act(async () => {
      state.count = 1
    })
    expect(screen.getAllByText('even: false')).toHaveLength(2)
    expect(state.info.isEven).toBe(false)
    expect(compute).toHaveBeenCalledTimes(2)
  })
})

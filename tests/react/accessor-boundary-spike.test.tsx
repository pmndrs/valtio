import { useLayoutEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { proxy, ref, useSnapshot } from 'valtio'

it('should ignore unrelated layout writes when an accessor returns a fresh object', () => {
  const state = proxy({
    count: 1,
    date: new Date(0),
    get selected() {
      return { count: this.count }
    },
    set selected(value: { count: number }) {
      this.count = value.count
    },
    get time() {
      return this.date.getTime()
    },
    set time(value: number) {
      this.date.setTime(value)
    },
  })
  const renders = vi.fn()
  const Component = () => {
    const tracked = useSnapshot(state)
    renders()
    useLayoutEffect(() => {
      state.time++
    })
    return <div>{tracked.selected.count}</div>
  }
  render(<Component />)
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(renders).toHaveBeenCalledTimes(1)
})

it('should notice opaque accessor replacement before subscribing', async () => {
  const state = proxy({
    box: ref({ value: { count: 1 } }),
    get selected() {
      return this.box.value
    },
    set selected(value: { count: number }) {
      this.box.value = value
    },
  })
  const Component = () => {
    const tracked = useSnapshot(state)
    useLayoutEffect(() => {
      state.selected = { count: 2 }
    }, [])
    return <div>{tracked.selected.count}</div>
  }
  render(<Component />)
  await act(() => Promise.resolve())
  expect(screen.getByText('2')).toBeInTheDocument()
})

it('should not reevaluate accessors to filter an unrelated write', async () => {
  const compute = vi.fn((date: Date) => date.getTime())
  const state = proxy({
    date: new Date(0),
    unrelated: 0,
    get time() {
      return compute(this.date)
    },
    set time(value: number) {
      this.date.setTime(value)
    },
  })
  const Component = () => {
    const tracked = useSnapshot(state)
    useLayoutEffect(() => {
      state.unrelated++
    })
    return <div>{tracked.time}</div>
  }
  render(<Component />)
  expect(compute).toHaveBeenCalledTimes(1)
  await act(async () => {
    state.unrelated++
  })
  expect(compute).toHaveBeenCalledTimes(1)
})

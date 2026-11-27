import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { batch, proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'
import { applyChanges, proxyMap, proxySet, subscribeKey } from 'valtio/utils'

describe('applyChanges', () => {
  it('should write only what differs', () => {
    const state = proxy({ user: { name: 'Ann', age: 30 }, count: 0 })
    const onName = vi.fn()
    const onAge = vi.fn()
    const onCount = vi.fn()
    subscribeKey(state.user, 'name', onName)
    subscribeKey(state.user, 'age', onAge)
    subscribeKey(state, 'count', onCount)
    const user = state.user

    applyChanges(state, { user: { name: 'Ann', age: 31 }, count: 0 })
    expect(state.user).toBe(user)
    expect(snapshot(state)).toEqual({
      user: { name: 'Ann', age: 31 },
      count: 0,
    })
    expect(onName).not.toHaveBeenCalled()
    expect(onAge).toHaveBeenCalledTimes(1)
    expect(onCount).not.toHaveBeenCalled()
  })

  it('should not notify when nothing differs', () => {
    const state = proxy({ list: [{ id: 1 }], nested: { a: 1 } })
    const callback = vi.fn()
    subscribe(state, callback)
    const snap = snapshot(state)

    applyChanges(state, { list: [{ id: 1 }], nested: { a: 1 } })
    expect(callback).not.toHaveBeenCalled()
    expect(snapshot(state)).toBe(snap)
  })

  it('should notify once for several changes', () => {
    const state = proxy({ a: 1, b: 1, nested: { c: 1 } })
    const callback = vi.fn()
    subscribe(state, callback)

    applyChanges(state, { a: 2, b: 2, nested: { c: 2 } })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should add and delete keys, also symbols', () => {
    const key = Symbol()
    const state = proxy<Record<string | symbol, unknown>>({ a: 1, b: 2 })

    applyChanges(state, { b: 2, c: 3, [key]: 4 })
    expect(Reflect.ownKeys(state)).toEqual(['b', 'c', key])
    expect(state[key]).toBe(4)

    applyChanges(state, { b: 2 })
    expect(Reflect.ownKeys(state)).toEqual(['b'])
  })

  it('should merge arrays by index and follow their length', () => {
    const state = proxy({ list: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    const [first, second] = state.list

    applyChanges(state, { list: [{ id: 1 }, { id: 20 }] })
    expect(snapshot(state.list)).toEqual([{ id: 1 }, { id: 20 }])
    expect(state.list[0]).toBe(first)
    expect(state.list[1]).toBe(second)

    applyChanges(state, { list: [{ id: 1 }, { id: 20 }, { id: 30 }] })
    expect(snapshot(state.list)).toEqual([{ id: 1 }, { id: 20 }, { id: 30 }])
  })

  it('should replace a value of another kind', () => {
    const state = proxy<{ value: unknown }>({ value: { a: 1 } })

    applyChanges(state, { value: [1] })
    expect(snapshot(state)).toEqual({ value: [1] })
    applyChanges(state, { value: 'text' })
    expect(state.value).toBe('text')
    applyChanges(state, { value: { b: 2 } })
    expect(snapshot(state)).toEqual({ value: { b: 2 } })
  })

  it('should never make an object of the caller state', () => {
    const next = Object.freeze({
      nested: Object.freeze({ count: 1 }),
      list: Object.freeze([Object.freeze({ id: 1 })]),
    })
    const state = proxy<{
      nested?: { count: number }
      list?: readonly { id: number }[]
    }>({})

    applyChanges(state, next)
    state.nested!.count++
    ;(state.list as { id: number }[]).push({ id: 2 })
    expect(snapshot(state)).toEqual({
      nested: { count: 2 },
      list: [{ id: 1 }, { id: 2 }],
    })
    expect(next).toEqual({ nested: { count: 1 }, list: [{ id: 1 }] })
  })

  it('should assign other values as they are', () => {
    class Item {
      count = 0
    }
    const date = new Date(0)
    const marked = ref({ a: 1 })
    const item = new Item()
    const other = proxy({ b: 1 })
    const map = proxyMap([['key', 1]])
    const state = proxy<Record<string, unknown>>({})

    applyChanges(state, { date, marked, item, other, map })
    expect(state.date).toBe(date)
    expect(state.marked).toBe(marked)
    expect(state.other).toBe(other)
    expect(state.map).toBe(map)
    // a class instance becomes state, as with an assignment
    ;(state.item as Item).count++
    expect(item.count).toBe(1)
  })

  it('should merge plain data into a class instance', () => {
    class User {
      name = 'Ann'
      age = 30
      greet() {
        return `Hi, ${this.name}`
      }
    }
    const state = proxy({ user: new User() })
    const { user } = state

    applyChanges(state, { user: { name: 'Bob', age: 30 } } as typeof state)
    expect(state.user).toBe(user)
    expect(state.user.greet()).toBe('Hi, Bob')
  })

  it('should create a key that is undefined', () => {
    const state = proxy<{ a?: undefined; b?: number }>({ b: 1 })

    applyChanges(state, { a: undefined })
    expect(Object.keys(state)).toEqual(['a'])
  })

  it('should require a proxy', () => {
    const state = proxy({ count: 0 })
    expect(() =>
      applyChanges(snapshot(state) as { count: number }, { count: 1 }),
    ).toThrow('applyChanges() requires a proxy as its first argument.')
    expect(() => applyChanges({ count: 0 }, { count: 1 })).toThrow(
      'applyChanges() requires a proxy as its first argument.',
    )
  })

  it('should rethrow subscriber errors in a microtask, like an assignment', () => {
    const state = proxy({ a: 0, b: 0 })
    subscribe(state, () => {
      throw new Error('boom')
    })
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, 'queueMicrotask')
      .mockImplementation(() => {})

    try {
      applyChanges(state, { a: 1, b: 1 })
      expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1)
    } finally {
      queueMicrotaskSpy.mockRestore()
    }
    expect(snapshot(state)).toEqual({ a: 1, b: 1 })
    expect(() => batch(() => applyChanges(state, { a: 2, b: 2 }))).toThrow(
      AggregateError,
    )
  })
})

describe('applyChanges with a snapshot', () => {
  it('should restore an earlier snapshot and keep the proxies', () => {
    const state = proxy({
      user: { name: 'Ann', tags: ['a'] },
      todos: [{ title: 'one', done: false }],
    })
    const { user } = state
    const todo = state.todos[0]
    const snap = snapshot(state)

    state.user.name = 'Bob'
    state.user.tags.push('b')
    state.todos[0]!.done = true
    state.todos.push({ title: 'two', done: false })
    const callback = vi.fn()
    subscribe(state, callback)

    applyChanges(state, snap)
    expect(snapshot(state)).toEqual(snap)
    expect(state.user).toBe(user)
    expect(state.todos[0]).toBe(todo)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should leave a subtree that has not changed since the snapshot', () => {
    const state = proxy({ unchanged: { a: 1 }, changed: { b: 1 } })
    const snap = snapshot(state)
    state.changed.b = 2
    const onUnchanged = vi.fn()
    subscribe(state.unchanged, onUnchanged)

    applyChanges(state, snap)
    expect(snapshot(state)).toEqual(snap)
    expect(snapshot(state).unchanged).toBe(snap.unchanged)
    expect(onUnchanged).not.toHaveBeenCalled()
  })

  it('should apply the snapshot of one object to another', () => {
    const state = proxy({
      a: { name: 'a', nested: { count: 1 } },
      b: { name: 'b', nested: { count: 2 } },
    })
    const { b } = state

    applyChanges(state.b, snapshot(state.a))
    expect(state.b).toBe(b)
    expect(snapshot(state.b)).toEqual({ name: 'a', nested: { count: 1 } })
    // the two objects stay apart
    state.b.nested.count = 3
    expect(state.a.nested.count).toBe(1)
  })

  it('should leave the state as it is for its own snapshot', () => {
    const state = proxy({ nested: { count: 0 }, list: [1, 2] })
    const snap = snapshot(state)
    const callback = vi.fn()
    subscribe(state, callback)

    applyChanges(state, snap)
    expect(callback).not.toHaveBeenCalled()
    expect(snapshot(state)).toBe(snap)
  })

  it('should take data that mixes new objects with snapshots', () => {
    const state = proxy({
      template: { tags: ['x'] },
      todos: [{ title: 'one', tags: ['a'] }],
    })
    const snap = snapshot(state)
    const first = state.todos[0]

    applyChanges(state, {
      ...snap,
      todos: [...snap.todos, { title: 'two', tags: snap.template.tags }],
    })
    expect(state.todos[0]).toBe(first)
    expect(snapshot(state.todos)).toEqual([
      { title: 'one', tags: ['a'] },
      { title: 'two', tags: ['x'] },
    ])
    // the new todo has its own copy of the tags
    state.todos[1]!.tags.push('y')
    expect(state.template.tags).toEqual(['x'])
  })

  it('should copy a snapshot where the proxy holds another object', () => {
    const state = proxy({
      items: [{ name: 'a' }, { name: 'b' }],
      selected: null as { name: string } | null,
    })
    state.selected = state.items[0]!
    const snap = snapshot(state)

    // the same key now holds the other item
    state.selected = state.items[1]!
    applyChanges(state, snap)
    expect(snapshot(state)).toEqual(snap)
    // the other item is not written
    expect(state.items[1]!.name).toBe('b')
    expect(state.selected).not.toBe(state.items[1])
  })

  it('should not write accessors', () => {
    const state = proxy({
      count: 1,
      get double() {
        return this.count * 2
      },
    })
    const snap = snapshot(state)
    state.count = 2

    applyChanges(state, snap)
    expect(state.count).toBe(1)
    expect(state.double).toBe(2)
    state.count = 5
    expect(state.double).toBe(10)

    // the accessor stays when the data has no such key
    applyChanges(state, { count: 3 } as typeof state)
    expect(state.double).toBe(6)
  })

  it('should keep the accessors of an object that it copies', () => {
    const state = proxy<{
      nested?: { count: number; readonly double: number }
    }>({})

    applyChanges(state, {
      nested: {
        count: 1,
        get double() {
          return this.count * 2
        },
      },
    })
    state.nested!.count = 4
    expect(state.nested!.double).toBe(8)
  })

  it('should throw for a snapshot of a collection that has changed', () => {
    const state = proxy({
      map: proxyMap([['a', 1]]),
      set: proxySet([1]),
      count: 0,
    })
    const snap = snapshot(state)

    // an unchanged collection is skipped
    state.count = 1
    applyChanges(state, snap)
    expect(state.count).toBe(0)

    state.map.set('b', 2)
    expect(() => applyChanges(state, snap)).toThrow(
      'applyChanges() cannot apply a snapshot of a proxyMap or proxySet.',
    )
    state.map.delete('b')
    state.set.add(2)
    expect(() => applyChanges(state, snap)).toThrow(
      'applyChanges() cannot apply a snapshot of a proxyMap or proxySet.',
    )
    expect(() =>
      applyChanges(proxy<{ map?: unknown }>({}), { map: snap.map }),
    ).toThrow(
      'applyChanges() cannot apply a snapshot of a proxyMap or proxySet.',
    )
  })

  it('should restore a state that refers to itself', () => {
    type Node = { name: string; parent?: Node; children: Node[] }
    const state = proxy<Node>({ name: 'root', children: [] })
    state.children.push({ name: 'child', parent: state, children: [] })
    const snap = snapshot(state)

    state.name = 'changed'
    state.children[0]!.name = 'changed too'
    applyChanges(state, snap)
    expect(state.name).toBe('root')
    expect(state.children[0]!.name).toBe('child')
    expect(state.children[0]!.parent).toBe(state)
  })

  it('should copy data that refers to itself', () => {
    type Node = { name: string; self?: Node }
    const next: Node = { name: 'a' }
    next.self = next
    const state = proxy<{ node?: Node }>({})

    applyChanges(state, { node: next })
    expect(state.node!.name).toBe('a')
    expect(state.node!.self).toBe(state.node)
  })
})

describe('applyChanges with useSnapshot', () => {
  it('should keep a reader of an equal value quiet', async () => {
    const state = proxy({ nested: { count: 0, text: 'a' } })
    const renderFn = vi.fn()
    const Component = () => {
      const tracked = useSnapshot(state)
      renderFn()
      return <div>count: {tracked.nested.count}</div>
    }

    render(<Component />)
    await act(async () => {
      applyChanges(state.nested, { count: 0, text: 'b' })
    })
    expect(renderFn).toHaveBeenCalledTimes(1)

    await act(async () => {
      applyChanges(state.nested, { count: 1, text: 'b' })
    })
    expect(screen.getByText('count: 1')).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)
  })

  it('should apply a value read from useSnapshot', async () => {
    const state = proxy({ form: { name: 'Ann', address: { city: 'Oslo' } } })
    let saved: unknown
    const Component = () => {
      const tracked = useSnapshot(state)
      saved ||= tracked.form
      return <div>name: {tracked.form.name}</div>
    }

    render(<Component />)
    const { address } = state.form
    await act(async () => {
      state.form.name = 'Bob'
      state.form.address.city = 'Rome'
    })
    expect(screen.getByText('name: Bob')).toBeInTheDocument()

    await act(async () => {
      applyChanges(state.form, saved as typeof state.form)
    })
    expect(screen.getByText('name: Ann')).toBeInTheDocument()
    expect(snapshot(state.form)).toEqual({
      name: 'Ann',
      address: { city: 'Oslo' },
    })
    expect(state.form.address).toBe(address)
  })
})

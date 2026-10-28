import { describe, expect, it, vi } from 'vitest'
import { batch, proxy, subscribe, unstable_getInternalStates } from 'valtio'

describe('subscribe with keys', () => {
  it('calls back with no arguments for a set or delete of a listed key', () => {
    const state = proxy<{ a?: number; b: number }>({ a: 0, b: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { keys: ['a'] })

    state.a = 1
    expect(callback).toHaveBeenCalledExactlyOnceWith()

    delete state.a
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('ignores other keys and writes under a listed key', () => {
    const state = proxy({ a: { count: 0 }, b: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { keys: ['a'] })

    state.b = 1
    state.a.count = 1
    expect(callback).not.toHaveBeenCalled()

    const oldA = state.a
    state.a = { count: 2 }
    expect(callback).toHaveBeenCalledTimes(1)
    oldA.count = 3
    state.a.count = 3
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('ignores an unchanged value and a delete of an absent key', () => {
    const state = proxy<{ a: number; b?: number }>({ a: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { keys: ['a', 'b'] })

    state.a = 0
    delete state.b
    expect(callback).not.toHaveBeenCalled()
  })

  it('hears the index and the length that an array write changes', () => {
    const state = proxy([0, 1, 2])
    const onIndex = vi.fn()
    const onLength = vi.fn()
    subscribe(state, onIndex, { keys: ['3'] })
    subscribe(state, onLength, { keys: ['length'] })

    state.push(3)
    expect(onIndex).toHaveBeenCalledTimes(1)
    expect(onLength).toHaveBeenCalledTimes(1)

    state[0] = 10
    expect(onLength).toHaveBeenCalledTimes(1)

    state[state.length] = 4
    expect(onLength).toHaveBeenCalledTimes(2)
  })

  it('hears the indices removed by shortening an array', () => {
    const state = proxy([{ count: 0 }, { count: 1 }, { count: 2 }])
    const removed = state[2]!
    const onRemoved = vi.fn()
    const onKept = vi.fn()
    const onAll = vi.fn()
    subscribe(state, onRemoved, { keys: ['2'] })
    subscribe(state, onKept, { keys: ['0'] })
    subscribe(state, onAll)

    state.length = 1
    expect(onRemoved).toHaveBeenCalledTimes(1)
    expect(onKept).not.toHaveBeenCalled()
    expect(onAll).toHaveBeenCalledTimes(1)

    // the removed item is no longer a child of the array
    removed.count = 3
    expect(onAll).toHaveBeenCalledTimes(1)
  })

  it('hears an index removed by pop once', () => {
    const state = proxy([1, 2])
    const onIndex = vi.fn()
    const onOwnKeys = vi.fn()
    subscribe(state, onIndex, { keys: ['1'] })
    subscribe(state, onOwnKeys, { ownKeys: true })

    // pop deletes the index, then sets the length
    state.pop()
    expect(onIndex).toHaveBeenCalledTimes(1)
    expect(onOwnKeys).toHaveBeenCalledTimes(1)
  })

  it('ignores the holes past a shorter length', () => {
    const state = proxy<number[]>([0])
    state.length = 3
    const onHole = vi.fn()
    const onLength = vi.fn()
    const onOwnKeys = vi.fn()
    subscribe(state, onHole, { keys: ['2'] })
    subscribe(state, onLength, { keys: ['length'] })
    subscribe(state, onOwnKeys, { ownKeys: true })

    state.length = 1
    expect(onHole).not.toHaveBeenCalled()
    expect(onOwnKeys).not.toHaveBeenCalled()
    expect(onLength).toHaveBeenCalledTimes(1)
  })

  it('shortens a sparse array that nothing depends on without visiting its holes', () => {
    const state = proxy<number[]>([])
    state.length = 10_000_000
    state[5] = 5
    const callback = vi.fn()
    subscribe(state, callback)

    const start = performance.now()
    state.length = 0
    // visiting every index would take seconds
    expect(performance.now() - start).toBeLessThan(100)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('throws for an invalid length without looking for indices', () => {
    const state = proxy([1, 2])
    subscribe(state, () => {}, { keys: ['length'] })

    expect(() => {
      state.length = -Infinity
    }).toThrow(RangeError)
    expect(state).toEqual([1, 2])
  })

  it('hears a length set by a setter once', () => {
    class List extends Array<number> {
      set size(value: number) {
        this.length = value
      }
    }
    const state = proxy(new List(1, 2, 3))
    const onLength = vi.fn()
    subscribe(state, onLength, { keys: ['length'] })
    ;(state as { size: number }).size = 1
    expect(onLength).toHaveBeenCalledTimes(1)
    expect(state.length).toBe(1)
  })

  it('calls back once per batch', () => {
    const state = proxy({ a: 0, b: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { keys: ['a', 'b', 'a'] })

    batch(() => {
      state.a = 1
      state.b = 1
      state.a = 2
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('stops after unsubscribing', () => {
    const state = proxy({ a: 0 })
    const callback = vi.fn()
    const unsubscribe = subscribe(state, callback, { keys: ['a', 'a'] })

    unsubscribe()
    state.a = 1
    expect(callback).not.toHaveBeenCalled()
  })

  it('does not link the subtree', () => {
    const state = proxy({ child: { count: 0 } })
    const { proxyStateMap } = unstable_getInternalStates()
    const childParentLinks = proxyStateMap.get(state.child)![3]

    subscribe(state, () => {}, { keys: ['child'], ownKeys: true })
    expect(childParentLinks.size).toBe(0)

    subscribe(state, () => {})
    expect(childParentLinks.size).toBe(1)
  })

  it.each([true, false, 'a'])('throws for keys: %s', (keys) => {
    const state = proxy({ a: 0 })
    expect(() => subscribe(state, () => {}, { keys: keys as never })).toThrow(
      'keys must be an array',
    )
  })

  it('listens to nothing with options that list nothing', () => {
    const state = proxy<{ a: number; b?: number }>({ a: 0 })
    const callback = vi.fn()
    subscribe(state, callback, {})
    subscribe(state, callback, { keys: [], ownKeys: false })

    state.a = 1
    state.b = 1
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('subscribe with ownKeys', () => {
  it('hears a key added and a key removed', () => {
    const state = proxy<{ a: number; b?: number }>({ a: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { ownKeys: true })

    state.b = 1
    expect(callback).toHaveBeenCalledExactlyOnceWith()

    delete state.b
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('ignores value writes, replaced children and writes under them', () => {
    const state = proxy({ a: 0, child: { count: 0 } })
    const callback = vi.fn()
    subscribe(state, callback, { ownKeys: true })

    state.a = 1
    state.child = { count: 1 }
    state.child.count = 2
    expect(callback).not.toHaveBeenCalled()
  })

  it('hears a key set over an inherited one', () => {
    const base = Object.create({ a: 0 }) as { a: number }
    const state = proxy(base)
    const callback = vi.fn()
    subscribe(state, callback, { ownKeys: true })

    state.a = 1
    expect(Object.keys(state)).toEqual(['a'])
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('hears array indices added and removed', () => {
    const state = proxy([0, 1, 2])
    const callback = vi.fn()
    subscribe(state, callback, { ownKeys: true })

    state[0] = 10
    expect(callback).not.toHaveBeenCalled()

    state.push(3)
    expect(callback).toHaveBeenCalledTimes(1)

    state.length = 1
    expect(callback).toHaveBeenCalledTimes(2)

    state.length = 5
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('combines with keys in one subscription', () => {
    const state = proxy<{ a?: number; b: number }>({ b: 0 })
    const callback = vi.fn()
    subscribe(state, callback, { keys: ['a'], ownKeys: true })

    // adds a listed key: one callback, not two
    state.a = 1
    expect(callback).toHaveBeenCalledTimes(1)

    state.a = 2
    expect(callback).toHaveBeenCalledTimes(2)

    state.b = 1
    expect(callback).toHaveBeenCalledTimes(2)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { proxy, ref, subscribe } from 'valtio'
import { applyChanges } from 'valtio/vanilla/utils'

describe('applyChanges', () => {
  it('does not skip undefined assignments to target accessors', () => {
    const setter = vi.fn()
    let value: number | undefined = 1
    const state = proxy({
      get value() {
        return value
      },
      set value(next: number | undefined) {
        setter(next)
        value = next
      },
    })

    applyChanges(state, { value: undefined })

    expect(state.value).toBeUndefined()
    expect(setter).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('reports an undefined assignment to a getter-only target', () => {
    const state = proxy<{ readonly value: number | undefined }>({
      get value() {
        return 1
      },
    })

    expect(() => applyChanges(state, { value: undefined })).toThrow(
      'could not set',
    )
    expect(state.value).toBe(1)
  })
  it('updates ordinary objects without replacing compatible children', () => {
    const state = proxy<{
      obj: { count: number; removed?: boolean; added?: boolean }
    }>({ obj: { count: 1, removed: true } })
    const obj = state.obj
    applyChanges(state, { obj: { count: 2, added: true } })
    expect(state.obj).toBe(obj)
    expect(state.obj).toEqual({ count: 2, added: true })
  })

  it('does not notify for equal values', () => {
    const state = proxy({ obj: { count: 1 }, items: [1, 2] })
    const callback = vi.fn()
    const unsubscribe = subscribe(state, callback, true)
    applyChanges(state, { obj: { count: 1 }, items: [1, 2] })
    expect(callback).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('shrinks sparse arrays using their actual length', () => {
    const state = proxy([1])
    state.length = 3
    applyChanges(state, [1])
    expect(state.length).toBe(1)
    const next = new Array<number>(4)
    next[1] = 2
    applyChanges(state, next)
    expect(state.length).toBe(4)
    expect(0 in state).toBe(false)
    expect(state[1]).toBe(2)
  })

  it('uses ordinary replacement for explicit proxies and refs', () => {
    const state = proxy({ obj: { count: 1 } })
    const next = proxy({ count: 2 })
    applyChanges(state, { obj: next })
    expect(state.obj).toBe(next)
    const value = ref({ count: 3 })
    applyChanges(state, { obj: value })
    expect(state.obj).toBe(value)
    applyChanges(state, { obj: { count: 4 } })
    expect(value.count).toBe(3)
    expect(state.obj).not.toBe(value)
  })

  it('replaces incompatible children', () => {
    const state = proxy<{ obj: object }>({ obj: { count: 1 } })
    applyChanges(state, { obj: [2] })
    expect(Array.isArray(state.obj)).toBe(true)
    const date = new Date()
    applyChanges(state, { obj: date })
    expect(state.obj).toBe(date)
  })

  it('supports symbols and null-prototype records', () => {
    const key = Symbol()
    const state = proxy(Object.assign(Object.create(null), { [key]: 1 }))
    const next = Object.assign(Object.create(null), { [key]: 2 })
    applyChanges(state, next)
    expect(state[key]).toBe(2)
    expect(Object.getPrototypeOf(state)).toBeNull()
  })

  it('rejects source accessors without evaluating them', () => {
    const getter = vi.fn(() => 2)
    const state = proxy({ count: 1 })
    expect(() =>
      applyChanges(state, {
        get count() {
          return getter()
        },
      }),
    ).toThrow('data properties only')
    expect(getter).not.toHaveBeenCalled()
    expect(state.count).toBe(1)
  })

  it('rejects inherited setters without changing the prototype', () => {
    const state = proxy({})
    const next = JSON.parse('{"__proto__":{"polluted":true}}')
    expect(() => applyChanges(state, next)).toThrow('inherited keys')
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype)
    expect(Object.hasOwn(state, '__proto__')).toBe(false)
  })

  it('reports failed writes and deletions', () => {
    const state = proxy(
      Object.defineProperty({ count: 1 }, 'count', { writable: false }),
    )
    expect(() => applyChanges(state, { count: 2 })).toThrow('could not set')
    const sealed = proxy(Object.seal({ count: 1 }))
    expect(() => applyChanges(sealed, {} as typeof sealed)).toThrow(
      'could not delete',
    )
  })

  it('requires compatible proxy roots', () => {
    expect(() => applyChanges({ count: 1 }, { count: 2 })).toThrow(
      'compatible records or arrays',
    )
    expect(() => applyChanges<object>(proxy({}), [])).toThrow(
      'compatible records or arrays',
    )
  })
})

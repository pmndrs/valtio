import { describe, expect, it, vi } from 'vitest'
import { getVersion, proxy, ref, snapshot, subscribe } from 'valtio'

const isProxy = (x: unknown) => getVersion(x) !== undefined

describe('proxy creation', () => {
  it('should default to an empty object', () => {
    const state = proxy()
    expect(snapshot(state)).toEqual({})
  })

  it('should throw when the base is not an object', () => {
    expect(() => proxy(1 as any)).toThrow('object required')
    expect(() => proxy('a' as any)).toThrow('object required')
    expect(() => proxy(null as any)).toThrow('object required')
  })

  it('should treat an explicit undefined as no argument', () => {
    expect(snapshot(proxy(undefined))).toEqual({})
  })

  it('should return the same proxy for a base object it already proxied', () => {
    const base = { count: 0 }
    expect(proxy(base)).toBe(proxy(base))
  })

  it('should wrap an existing proxy again rather than returning it', () => {
    const state = proxy({ count: 0 })
    const wrapped = proxy(state)
    expect(wrapped).not.toBe(state)
    expect(wrapped.count).toBe(0)
  })
})

describe('proxy nested values', () => {
  it('should proxy nested objects present at creation', () => {
    const state = proxy({ nested: { count: 0 } })
    expect(isProxy(state.nested)).toBe(true)
  })

  it('should proxy objects assigned after creation', () => {
    const state = proxy<{ nested?: { count: number } }>({})
    state.nested = { count: 0 }
    expect(isProxy(state.nested)).toBe(true)
  })

  it('should keep the identity of a value that is already a proxy', () => {
    const child = proxy({ count: 0 })
    const state = proxy<{ child?: object }>({})
    state.child = child
    expect(state.child).toBe(child)
  })

  it('should reuse one proxy for a base object assigned to two properties', () => {
    const base = { count: 0 }
    const state = proxy({ a: base, b: base })
    expect(state.a).toBe(state.b)
  })

  it('should propagate nested mutations to the parent version', () => {
    const state = proxy({ nested: { count: 0 } })
    const before = getVersion(state)
    state.nested.count += 1
    expect(getVersion(state)).toBeGreaterThan(before as number)
  })
})

describe('proxy boundaries', () => {
  const notProxied: [string, () => object][] = [
    ['Date', () => new Date()],
    ['RegExp', () => /x/],
    ['Error', () => new Error('e')],
    ['Promise', () => Promise.resolve(1)],
    ['WeakMap', () => new WeakMap()],
    ['WeakSet', () => new WeakSet()],
    ['ArrayBuffer', () => new ArrayBuffer(8)],
    ['Number object', () => new Number(1)],
    ['String object', () => new String('s')],
    ['Map', () => new Map()],
    ['Set', () => new Set()],
    ['custom iterable', () => ({ *[Symbol.iterator]() {} })],
  ]

  for (const [name, create] of notProxied) {
    it(`should not proxy ${name}`, () => {
      const state = proxy({ value: create() })
      expect(isProxy(state.value)).toBe(false)
    })
  }

  it('should proxy arrays', () => {
    const state = proxy({ value: [1, 2, 3] })
    expect(isProxy(state.value)).toBe(true)
  })

  it('should proxy class instances and keep the prototype', () => {
    class Counter {
      count = 0
      inc() {
        this.count += 1
      }
      get double() {
        return this.count * 2
      }
    }
    const state = proxy(new Counter())

    expect(isProxy(state)).toBe(true)
    expect(state).toBeInstanceOf(Counter)

    state.inc()
    expect(state.count).toBe(1)
    expect(state.double).toBe(2)

    const snap = snapshot(state)
    expect(Object.getPrototypeOf(snap)).toBe(Counter.prototype)
    expect(snap.double).toBe(2)
  })

  it('should not proxy objects wrapped in ref', () => {
    const state = proxy({ value: ref({ count: 0 }) })
    expect(isProxy(state.value)).toBe(false)
  })
})

describe('proxy property descriptors', () => {
  it('should not proxy non-writable properties present at creation', () => {
    const base = Object.defineProperty({}, 'fixed', {
      value: { count: 0 },
      writable: false,
      enumerable: true,
    })
    const state = proxy(base) as { fixed: object }
    expect(isProxy(state.fixed)).toBe(false)
  })

  it('should not proxy values returned from getters', () => {
    const state = proxy({
      get computed() {
        return { count: 0 }
      },
    })
    expect(isProxy(state.computed)).toBe(false)
  })

  it('should support symbol keys', async () => {
    const key = Symbol('key')
    const state = proxy({ [key]: { count: 0 } })
    const handler = vi.fn()
    subscribe(state, handler)

    expect(isProxy(state[key])).toBe(true)
    expect(key in snapshot(state)).toBe(true)

    state[key].count += 1
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should keep non-enumerable properties out of Object.keys', () => {
    const base = Object.defineProperty({ a: 1 }, 'hidden', {
      value: 2,
      enumerable: false,
    })
    const state = proxy(base) as { a: number; hidden: number }
    expect(Object.keys(state)).toEqual(['a'])
    expect(state.hidden).toBe(2)
  })

  it('should support setters', () => {
    const state = proxy({
      first: 'a',
      last: 'b',
      get full() {
        return `${this.first} ${this.last}`
      },
      set full(value: string) {
        ;[this.first, this.last] = value.split(' ') as [string, string]
      },
    })
    state.full = 'x y'
    expect(state.first).toBe('x')
    expect(state.last).toBe('y')
  })
})

describe('proxy arrays', () => {
  it('should track push, pop and splice', async () => {
    const state = proxy([0, 1, 2])
    const handler = vi.fn()
    subscribe(state, handler)

    state.push(3)
    await Promise.resolve()
    expect([...state]).toEqual([0, 1, 2, 3])

    state.pop()
    await Promise.resolve()
    expect([...state]).toEqual([0, 1, 2])

    state.splice(1, 1, 10, 11)
    await Promise.resolve()
    expect([...state]).toEqual([0, 10, 11, 2])

    expect(handler).toBeCalledTimes(3)
  })

  it('should track length assignment', async () => {
    const state = proxy([0, 1, 2])
    const handler = vi.fn()
    subscribe(state, handler)

    state.length = 1
    await Promise.resolve()
    expect([...state]).toEqual([0])
    expect(handler).toBeCalledTimes(1)
  })

  it('should proxy objects pushed into an array', () => {
    const state = proxy<{ count: number }[]>([])
    state.push({ count: 0 })
    expect(isProxy(state[0])).toBe(true)
  })

  it('should support sort and reverse', () => {
    const state = proxy([3, 1, 2])
    state.sort()
    expect([...state]).toEqual([1, 2, 3])
    state.reverse()
    expect([...state]).toEqual([3, 2, 1])
  })

  it('should keep length in sync with sparse assignment', () => {
    const state = proxy([0])
    state[3] = 3
    expect(state.length).toBe(4)
    expect(snapshot(state)).toEqual([0, undefined, undefined, 3])
  })
})

describe('proxy deletion', () => {
  it('should notify on delete and reflect it in the snapshot', async () => {
    const state = proxy<{ count?: number }>({ count: 1 })
    const handler = vi.fn()
    subscribe(state, handler)

    delete state.count
    await Promise.resolve()
    expect('count' in state).toBe(false)
    expect(snapshot(state)).toEqual({})
    expect(handler).toBeCalledTimes(1)
  })

  // Reflect.deleteProperty returns true for a key that was never present, so
  // the delete trap notifies. Setting an unchanged value, by contrast, does not.
  it('should notify even when deleting an absent property', async () => {
    const state = proxy<{ count?: number }>({})
    const handler = vi.fn()
    subscribe(state, handler)

    delete state.count
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should stop tracking a deleted nested proxy', async () => {
    const state = proxy<{ nested?: { count: number } }>({
      nested: { count: 0 },
    })
    const nested = state.nested as { count: number }
    const handler = vi.fn()
    subscribe(state, handler)

    delete state.nested
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)

    nested.count += 1
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })
})

describe('getVersion', () => {
  it('should return undefined for a non-proxy', () => {
    expect(getVersion({})).toBeUndefined()
    expect(getVersion(1)).toBeUndefined()
    expect(getVersion(null)).toBeUndefined()
  })

  it('should increase on mutation', () => {
    const state = proxy({ count: 0 })
    const before = getVersion(state) as number
    state.count += 1
    expect(getVersion(state)).toBeGreaterThan(before)
  })

  it('should not change when a property is set to the same value', () => {
    const state = proxy({ count: 0 })
    const before = getVersion(state)
    state.count = 0
    expect(getVersion(state)).toBe(before)
  })
})

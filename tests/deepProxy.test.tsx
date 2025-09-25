import { describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import {
  unstable_deepProxy as deepProxy,
  isProxyMap,
  isProxySet,
  proxyMap,
  proxySet,
} from 'valtio/utils'

describe('deepProxy – core behavior', () => {
  it('should properly clone a proxySet', () => {
    const original = proxySet<number>([1, 2, 3])
    const cloned = deepProxy(original)

    expect([...cloned]).toEqual([...original])
    expect(cloned).not.toBe(original)
    expect(isProxySet(cloned)).toBe(true)
  })

  it('should maintain proxySet reactivity', () => {
    const state = proxy({
      count: 0,
      set: proxySet<number>([1, 2, 3]),
    })

    const cloned = deepProxy(state)

    cloned.set.add(4)
    expect([...cloned.set]).toContain(4)
    expect(() => cloned.set.add(5)).not.toThrow()
  })

  it('should properly clone a proxyMap', () => {
    const original = proxyMap<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const cloned = deepProxy(original)

    expect([...cloned.entries()]).toEqual([...original.entries()])
    expect(cloned).not.toBe(original)
    expect(isProxyMap(cloned)).toBe(true)
  })

  it('should maintain proxyMap reactivity', () => {
    const state = proxy({
      count: 0,
      map: proxyMap<string, number>([
        ['a', 1],
        ['b', 2],
      ]),
    })

    const cloned = deepProxy(state)

    cloned.map.set('c', 3)
    expect(cloned.map.get('c')).toBe(3)
    expect(() => cloned.map.set('d', 4)).not.toThrow()
  })

  // Complex object with both proxySet and proxyMap
  it('should handle complex objects with both proxySet and proxyMap', () => {
    const original = proxy({
      name: 'test',
      count: 42,
      set: proxySet<number>([1, 2, 3]),
      map: proxyMap<string, any>([
        ['a', 1],
        ['b', { nested: true }],
        ['c', proxySet<string>(['x', 'y', 'z'])],
      ]),
      nested: {
        anotherSet: proxySet<string>(['a', 'b', 'c']),
      },
    })

    const cloned = deepProxy(original)

    expect(cloned.name).toBe('test')
    expect(cloned.count).toBe(42)

    // proxySet
    expect([...cloned.set]).toEqual([1, 2, 3])

    // proxyMap
    expect(cloned.map.get('a')).toBe(1)
    expect(cloned.map.get('b')).toEqual({ nested: true })

    // nested proxySet inside proxyMap
    const nestedSet = cloned.map.get('c')
    expect([...nestedSet]).toEqual(['x', 'y', 'z'])
    expect(typeof nestedSet.add).toBe('function')

    // nested object with proxySet
    expect([...cloned.nested.anotherSet]).toEqual(['a', 'b', 'c'])

    // reactivity preserved
    expect(() => cloned.set.add(4)).not.toThrow()
    expect(() => cloned.map.set('d', 4)).not.toThrow()
    expect(() => cloned.map.get('c').add('w')).not.toThrow()
    expect(() => cloned.nested.anotherSet.add('d')).not.toThrow()
  })

  // Edge cases
  it('should handle empty proxySet and proxyMap', () => {
    const original = proxy({
      emptySet: proxySet<number>(),
      emptyMap: proxyMap<string, number>(),
    })

    const cloned = deepProxy(original)

    expect(cloned.emptySet.size).toBe(0)
    expect(cloned.emptyMap.size).toBe(0)

    expect(() => cloned.emptySet.add(1)).not.toThrow()
    expect(() => cloned.emptyMap.set('a', 1)).not.toThrow()
  })
})

// -----------------
// Extra edge cases
// -----------------
describe('deepProxy – additional edge cases', () => {
  it('handles a simple circurlar ref', () => {
    const a: any = { name: 'a' }
    a.self = a

    const cloned = deepProxy(a)
    expect(cloned).not.toBe(a)
    expect(cloned.name).toBe('a')
    expect(cloned.self).toBe(cloned)
  })

  it('handles mutual circular references across two objects', () => {
    const a: any = { name: 'a' }
    const b: any = { name: 'b' }
    a.b = b
    b.a = a

    const cloned = deepProxy(a)
    expect(cloned).not.toBe(a)
    expect(cloned.name).toBe('a')
    expect(cloned.b.name).toBe('b')
    expect(cloned.b.a).toBe(cloned)
  })

  it('preserves shared references (aliasing)', () => {
    const shared = { id: 123 }
    const obj = {
      left: { child: shared },
      right: { child: shared },
    }

    const cloned = deepProxy(obj)
    expect(cloned).not.toBe(obj)
    expect(cloned.left.child).not.toBe(shared)
    expect(cloned.right.child).not.toBe(shared)
    expect(cloned.left.child).toBe(cloned.right.child)
  })

  it('converts native Set/Map to proxySet/proxyMap recursively', () => {
    const obj = {
      s: new Set([1, 2, 3]),
      m: new Map<string, any>([
        ['x', 1],
        ['y', { z: 9 }],
      ]),
    }

    const cloned = deepProxy(obj)

    expect(isProxySet(cloned.s)).toBe(true)
    expect(isProxyMap(cloned.m)).toBe(true)

    expect([...cloned.s]).toEqual([1, 2, 3])
    expect(cloned.m.get('x')).toBe(1)
    expect(cloned.m.get('y')).toEqual({ z: 9 })

    expect(() => cloned.s.add(99)).not.toThrow()
    expect(() => cloned.m.set('k', 42)).not.toThrow()
  })

  it('normalizes nested native Set/Map into proxySet/proxyMap', () => {
    const obj = {
      list: [new Set(['a', 'b']), { inner: new Map([['k', new Set([1, 2])]]) }],
    }

    const cloned = deepProxy(obj)
    const s0 = cloned.list[0] as unknown as Set<string>
    expect(isProxySet(s0)).toBe(true)
    expect([...s0]).toEqual(['a', 'b'])

    const m = (cloned.list[1] as any).inner as Map<string, Set<number>>
    expect(isProxyMap(m)).toBe(true)
    const innerS = m.get('k')!
    expect(isProxySet(innerS)).toBe(true)
    expect([...innerS]).toEqual([1, 2])
  })

  it('leaves functions as-is (callable identity preserved)', () => {
    const fn = vi.fn((x: number) => x * 2)
    const obj = { fn }
    const cloned = deepProxy(obj)

    expect(cloned.fn).toBe(fn)
    expect(cloned.fn(3)).toBe(6)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('preserves symbol-keyed properties and descriptors', () => {
    const sym = Symbol('secret')
    const obj: any = { visible: 1 }
    Object.defineProperty(obj, sym, {
      value: 42,
      enumerable: false,
      configurable: true,
      writable: true,
    })

    const cloned = deepProxy(obj)
    expect(cloned.visible).toBe(1)

    const desc = Object.getOwnPropertyDescriptor(cloned, sym)!
    expect(desc.enumerable).toBe(false)
    expect(desc.value).toBe(42)
  })

  it('preserves non-enumerable and non-writable string-keyed descriptors', () => {
    const obj: any = {}
    Object.defineProperty(obj, 'hidden', {
      value: 7,
      enumerable: false,
      configurable: true,
      writable: false,
    })

    const cloned = deepProxy(obj)
    const d = Object.getOwnPropertyDescriptor(cloned, 'hidden')!
    expect(d.enumerable).toBe(false)
    expect(d.writable).toBe(false)
    expect(d.value).toBe(7)
  })

  it('preserves getter/setter behavior and metadata', () => {
    const store: { _x: number } = { _x: 1 }
    const obj: any = {}
    Object.defineProperty(obj, 'x', {
      get() {
        return store._x
      },
      set(v: number) {
        store._x = v
      },
      enumerable: true,
      configurable: true,
    })

    const cloned = deepProxy(obj)
    expect(cloned.x).toBe(1)
    cloned.x = 10
    expect(store._x).toBe(10)

    const d = Object.getOwnPropertyDescriptor(cloned, 'x')!
    expect(typeof d.get).toBe('function')
    expect(typeof d.set).toBe('function')
  })

  it('preserves prototype chain of custom classes (methods continue to work)', () => {
    class Counter {
      n: number
      constructor(n: number) {
        this.n = n
      }
      inc() {
        this.n += 1
      }
    }
    const c = new Counter(5)
    const obj = { c }

    const cloned = deepProxy(obj)
    const cc = cloned.c as any
    expect(Object.getPrototypeOf(cc)).toBe(Counter.prototype)
    expect(cc.n).toBe(5)
    cc.inc()
    expect(cc.n).toBe(6)
  })

  it('handles arrays with holes and custom non-enum props', () => {
    const arr: any[] = []
    arr[2] = 'two' // holes at 0 and 1
    Object.defineProperty(arr, 'meta', {
      value: 'info',
      enumerable: false,
    })
    const obj = { arr }

    const cloned = deepProxy(obj)
    expect(0 in cloned.arr).toBe(false)
    expect(1 in cloned.arr).toBe(false)
    expect(cloned.arr[2]).toBe('two')

    const d = Object.getOwnPropertyDescriptor(cloned.arr, 'meta')!
    expect(d.enumerable).toBe(false)
    expect(d.value).toBe('info')
  })

  it('respects a provided refSet: passes through exotic instances by identity', () => {
    const date = new Date('2020-01-02T03:04:05.000Z')
    const re = /abc/gi
    const buf = new ArrayBuffer(8)
    const u8 = new Uint8Array(buf)
    u8[0] = 123

    const refSet = new WeakSet<object>([date, re, buf, u8])

    const obj = {
      date,
      re,
      buf,
      u8,
      nested: { date, u8 },
    }

    const cloned = deepProxy(obj, () => refSet)

    expect(cloned.date).toBe(date)
    expect(cloned.re).toBe(re)
    expect(cloned.buf).toBe(buf)
    expect(cloned.u8).toBe(u8)
    expect(cloned.nested.date).toBe(date)
    expect(cloned.nested.u8).toBe(u8)

    // functionality intact
    expect(cloned.date.getUTCFullYear()).toBe(2020)
    expect(cloned.re.test('XYZabc')).toBe(true)
    expect(cloned.u8[0]).toBe(123)
  })

  it('deeply proxies inside a proxied state object while keeping primitives by value', () => {
    const state = proxy({
      title: 'hello',
      count: 1,
      nested: {
        arr: [1, 2, 3],
        s: proxySet([1, 2]),
        m: proxyMap([
          ['x', 10],
          ['y', 20],
        ]),
      },
    })

    const cloned = deepProxy(state)
    expect(cloned.title).toBe('hello')
    expect(cloned.count).toBe(1)
    expect([...cloned.nested.arr]).toEqual([1, 2, 3])
    expect([...cloned.nested.s]).toEqual([1, 2])
    expect(cloned.nested.m.get('x')).toBe(10)

    expect(() => cloned.nested.s.add(3)).not.toThrow()
    expect(() => cloned.nested.m.set('z', 30)).not.toThrow()
  })
})

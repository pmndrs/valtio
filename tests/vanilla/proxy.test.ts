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

  it.each([
    (state: { count: number }) => new Proxy(state, {}),
    (state: { count: number }) => proxy(state),
    (state: { count: number }) => proxy(proxy(state)),
  ])('should notify the original proxy through a wrapper (%#)', (wrap) => {
    const state = proxy({ count: 0 })
    const wrapped = wrap(state)
    const handler = vi.fn()
    const unsubscribe = subscribe(state, handler, true)
    const snap = snapshot(state)

    wrapped.count = 1

    expect(state.count).toBe(1)
    expect(snapshot(state).count).toBe(1)
    expect(snap.count).toBe(0)
    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('should proxy and track children assigned through a transparent wrapper', () => {
    const state = proxy({ child: { count: 0 } })
    const wrapped = new Proxy(state, {})
    const handler = vi.fn()
    const unsubscribe = subscribe(state, handler, true)
    snapshot(state)

    wrapped.child = { count: 1 }
    expect(snapshot(state).child.count).toBe(1)
    state.child.count = 2
    expect(snapshot(state).child.count).toBe(2)
    expect(handler).toHaveBeenCalledTimes(2)
    unsubscribe()
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

  it('should replace an existing proxy with a raw object', () => {
    const state = proxy<{
      nested: { count: number; removed?: boolean; added?: boolean }
    }>({ nested: { count: 0, removed: true } })
    const nested = state.nested

    state.nested = { count: 1, added: true }

    expect(state.nested).not.toBe(nested)
    expect(nested).toEqual({ count: 0, removed: true })
    expect(snapshot(state.nested)).toEqual({ count: 1, added: true })
  })

  it('should respect the set receiver when replacing', () => {
    const state = proxy({ nested: { count: 0 } })
    const nested = state.nested
    const derived = Object.create(state) as typeof state

    derived.nested = { count: 1 }

    expect(Object.prototype.hasOwnProperty.call(derived, 'nested')).toBe(true)
    expect(derived.nested.count).toBe(1)
    expect(state.nested).toBe(nested)
    expect(state.nested.count).toBe(0)
  })

  it('should not evaluate removed descendants when replacing', () => {
    const getter = vi.fn(() => {
      throw new Error('unexpected')
    })
    const state = proxy<{ nested: { removed?: object } }>({
      nested: {
        removed: {
          get value() {
            return getter()
          },
        },
      },
    })

    expect(() => {
      state.nested = {}
    }).not.toThrow()
    expect(getter).not.toHaveBeenCalled()
  })

  it('should replace an existing non-writable or non-extensible child', () => {
    const nonWritable = Object.defineProperty({ value: 1 }, 'value', {
      writable: false,
    })
    const first = proxy({ nested: nonWritable })
    const firstNested = first.nested

    first.nested = { value: 2 }

    expect(first.nested).not.toBe(firstNested)
    expect(first.nested.value).toBe(2)

    const nonExtensible = Object.preventExtensions<{
      value: number
      added?: number
    }>({ value: 1 })
    const second = proxy({ nested: nonExtensible })
    const secondNested = second.nested

    second.nested = { value: 1, added: 2 }

    expect(second.nested).not.toBe(secondNested)
    expect(second.nested.added).toBe(2)
  })

  it('should preserve own properties that shadow inherited properties', () => {
    const next = JSON.parse('{"__proto__":{"polluted":true}}') as Record<
      PropertyKey,
      unknown
    >
    next.constructor = Object
    next.toString = Object.prototype.toString
    const state = proxy({ nested: {} as Record<PropertyKey, unknown> })
    const prevNested = state.nested

    state.nested = next

    expect(state.nested).not.toBe(prevNested)
    expect(
      Object.prototype.hasOwnProperty.call(state.nested, '__proto__'),
    ).toBe(true)
    expect(
      Object.prototype.hasOwnProperty.call(state.nested, 'constructor'),
    ).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(state.nested, 'toString')).toBe(
      true,
    )
    expect(Object.getPrototypeOf(state.nested)).toBe(Object.prototype)
  })

  it('should preserve descriptors by replacing incompatible objects', () => {
    const first = proxy({ nested: { value: 0 } })
    const firstNested = first.nested

    first.nested = Object.freeze({ value: 1 })

    expect(first.nested).not.toBe(firstNested)
    expect(Object.isExtensible(first.nested)).toBe(false)
    expect(
      Object.getOwnPropertyDescriptor(first.nested, 'value'),
    ).toMatchObject({ writable: false, configurable: false })

    const next = Object.defineProperty({}, 'value', {
      value: 1,
      writable: true,
      configurable: true,
      enumerable: false,
    }) as { value: number }
    const second = proxy({ nested: {} as { value?: number } })
    const secondNested = second.nested

    second.nested = next

    expect(second.nested).not.toBe(secondNested)
    expect(
      Object.getOwnPropertyDescriptor(second.nested, 'value'),
    ).toMatchObject({ enumerable: false })
  })

  it('should replace an existing proxy with an explicitly created proxy', () => {
    const state = proxy({ nested: { count: 0 } })
    const nested = state.nested
    const nextNested = proxy({ count: 1 })

    state.nested = nextNested

    expect(state.nested).not.toBe(nested)
    expect(state.nested).toBe(nextNested)
  })

  it('should replace an existing proxy with a raw array', () => {
    const state = proxy({ values: [1, 2, 3] })
    const values = state.values

    state.values = [1, 4]

    expect(state.values).not.toBe(values)
    expect(values).toEqual([1, 2, 3])
    expect(snapshot(state.values)).toEqual([1, 4])
  })

  it('should replace a sparse array', () => {
    const values = [1]
    values.length = 3
    const state = proxy({ values })
    const prevValues = state.values

    state.values = [1]

    expect(state.values).not.toBe(prevValues)
    expect(prevValues.length).toBe(3)
    expect(state.values.length).toBe(1)
  })

  it('should replace arrays with different prototypes', () => {
    class SpecialArray<T> extends Array<T> {}
    const state = proxy<{ values: number[] }>({ values: [1] })
    const plainValues = state.values
    const specialValues = new SpecialArray<number>()
    specialValues.push(2)

    state.values = specialValues
    expect(state.values).not.toBe(plainValues)
    expect(state.values).toBeInstanceOf(SpecialArray)

    const proxiedSpecialValues = state.values
    state.values = [3]
    expect(state.values).not.toBe(proxiedSpecialValues)
    expect(state.values).not.toBeInstanceOf(SpecialArray)
  })

  it('should replace incompatible raw values', () => {
    class Value {
      constructor(public count: number) {}
    }
    const state = proxy<{ value: Value | number[] }>({ value: new Value(0) })
    const value = state.value

    state.value = new Value(1)
    expect(state.value).not.toBe(value)
    expect(state.value).toBeInstanceOf(Value)

    const nextValue = state.value
    state.value = [1]
    expect(state.value).not.toBe(nextValue)
    expect(Array.isArray(state.value)).toBe(true)
  })

  it('should preserve assigned cycles and shared objects', () => {
    type Node = {
      value: number
      self?: Node
      a?: Node
      b?: Node
    }
    const state = proxy({ node: { value: 0 } as Node })
    const node = state.node
    const shared: Node = { value: 1 }
    const next: Node = { value: 2, a: shared, b: shared }
    next.self = next

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.self).toBe(state.node)
    expect(state.node.a).toBe(state.node.b)
    expect(snapshot(state.node).value).toBe(2)
  })

  it('should preserve ancestor aliases in assigned subgraphs', () => {
    type Node = { value: number; child?: { parent: Node } }
    const state = proxy({ node: { value: 0 } as Node })
    const node = state.node
    const next: Node = { value: 1 }
    next.child = { parent: next }

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.child?.parent).toBe(state.node)
  })

  it('should install an assigned raw cycle', () => {
    type Node = { value: number; self?: Node }
    const state = proxy({
      node: { value: 0, self: { value: 1 } } as Node,
    })
    const node = state.node
    const self = state.node.self
    const next: Node = { value: 2 }
    next.self = next

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.self).not.toBe(self)
    expect(state.node.self).toBe(state.node)
    expect(state.node.self?.self).toBe(state.node.self)
  })

  it('should replace an existing cycle with distinct values', () => {
    type Node = { value: number; self?: Node }
    const current: Node = { value: 0 }
    current.self = current
    const state = proxy({ node: current })
    const node = state.node
    const next: Node = { value: 1, self: { value: 2 } }

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.self).not.toBe(state.node)
    expect(state.node.value).toBe(1)
    expect(state.node.self?.value).toBe(2)
  })

  it('should preserve an explicit proxy in an assigned graph', () => {
    type Node = { self?: Node }
    const current: Node = {}
    current.self = current
    const state = proxy({ node: current })
    const explicit = proxy<Node>({})
    const next: Node = { self: { self: explicit } }

    state.node = next

    expect(state.node.self?.self).toBe(explicit)
  })

  it('should preserve an assigned ancestor cycle', () => {
    type Node = { value: number; child?: { value: number; parent: Node } }
    const current = { value: 0 } as Node
    current.child = { value: 1, parent: current }
    const state = proxy({ node: current })
    const node = state.node
    const child = state.node.child
    const next = { value: 2 } as Node
    next.child = { value: 3, parent: next }

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.child).not.toBe(child)
    expect(state.node.child?.parent).toBe(state.node)
    expect(state.node.child?.value).toBe(3)
  })

  it('should preserve cross-linked ancestors in assigned cycles', () => {
    type Node = { value: number; a?: Node; b?: Node }
    const current: Node = { value: 0 }
    current.a = current
    current.b = current
    const next: Node = { value: 0 }
    const first: Node = { value: 1 }
    const second: Node = { value: 2 }
    next.a = second
    first.b = next
    second.a = first
    second.b = next
    const state = proxy({ node: current })

    state.node = next

    expect(state.node.a?.b).toBe(state.node)
    expect(state.node.a?.a?.b).toBe(state.node)
    expect(state.node.b).toBeUndefined()
  })

  it('should preserve multiple cycles in assigned subgraphs', () => {
    type Node = { a?: Node; b?: Node; c?: Node }
    const current: Node = {}
    current.a = current
    const next: Node = {}
    const a: Node = {}
    const b: Node = {}
    const c: Node = {}
    next.a = a
    a.a = b
    a.c = c
    b.a = a
    b.b = b
    b.c = next
    c.a = b
    const state = proxy({ node: current })
    const node = state.node

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.a?.a?.a).toBe(state.node.a)
    expect(state.node.a?.a?.c).toBe(state.node)
  })

  it('should replace existing identities with assigned raw aliases', () => {
    type Node = { id: number; a?: Node; b?: Node }
    const current: Node = { id: 0 }
    current.b = current
    const child: Node = { id: 1 }
    child.b = child
    const next: Node = { id: 0, a: child, b: child }
    const state = proxy({ node: current })
    const node = state.node
    const b = state.node.b

    state.node = next

    expect(state.node).not.toBe(node)
    expect(state.node.b).not.toBe(b)
    expect(state.node.a).toBe(state.node.b)
  })

  it('should preserve raw aliases in replacements', () => {
    const state = proxy({ node: { a: { value: 1 }, b: { value: 1 } } })
    const a = state.node.a
    const b = state.node.b
    const shared = { value: 2 }

    state.node = { a: shared, b: shared }

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.b).toBe(state.node.a)
    expect(state.node.a.value).toBe(2)
    expect(state.node.b.value).toBe(2)
  })

  it('should preserve aliases across different assigned depths', () => {
    const state = proxy<{
      node: { a: { value: number }; b?: { a: { value: number } } }
    }>({ node: { a: { value: 1 } } })
    const a = state.node.a
    const shared = { value: 2 }

    state.node = { a: shared, b: { a: shared } }

    expect(state.node.a).not.toBe(a)
    expect(state.node.b?.a).toBe(state.node.a)
    expect(state.node.b?.a.value).toBe(2)
  })

  it('should replace old shared topology with the assigned graph', () => {
    const shared = { value: 1 }
    const state = proxy({ node: { a: shared, b: shared, c: shared } })
    const value = state.node.a
    const first = { value: 2 }
    const second = { value: 3 }

    state.node = { b: first, a: second, c: first }

    expect(state.node.a).not.toBe(value)
    expect(state.node.b).not.toBe(value)
    expect(state.node.c).toBe(state.node.b)
    expect(state.node.a).not.toBe(state.node.b)
    expect(state.node.a.value).toBe(3)
    expect(Object.keys(state.node)).toEqual(['b', 'a', 'c'])
  })

  it('should preserve distinct assigned nodes alongside aliases', () => {
    const shared = { child: { value: 0 } }
    const state = proxy({ root: { a: shared, b: shared, c: shared } })
    const first = { child: { value: 1 } }
    const second = { child: { value: 2 } }

    state.root = { a: first, b: second, c: first }

    expect(state.root.a).not.toBe(state.root.b)
    expect(state.root.a).toBe(state.root.c)
    expect(state.root.a.child.value).toBe(1)
    expect(state.root.b.child.value).toBe(2)
  })

  it('should split shared edges with a replacement', () => {
    type Node = { a?: Node; b?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const next: Node = {}
    next.a = next
    next.b = {}
    const state = proxy({ node: current })
    const a = state.node.a
    const b = state.node.b

    state.node = next

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.a).not.toBe(state.node.b)
  })

  it('should replace cyclic edges with shared leaves', () => {
    type Node = { a?: Node; b?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const child = {}
    const next = { a: child, b: child }
    const state = proxy({ node: current })
    const a = state.node.a
    const b = state.node.b

    state.node = next

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.a).toBe(state.node.b)
  })

  it('should preserve shared children pointing back to their parent', () => {
    type Node = { a?: Node; b?: Node; c?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const next: Node = {}
    const child: Node = {}
    const nested: Node = {}
    next.a = child
    next.b = child
    child.b = nested
    child.c = nested
    nested.a = next
    const state = proxy({ node: current })
    const a = state.node.a
    const b = state.node.b

    state.node = next

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.a).toBe(state.node.b)
  })

  it('should reuse previously proxied raw edges', () => {
    const shared = { value: 2 }
    const source = { a: shared, b: shared }
    proxy(source)
    const state = proxy({
      node: { a: { value: 0 }, b: { value: 1 } },
    })
    const a = state.node.a
    const b = state.node.b

    state.node = source

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.a).toBe(state.node.b)
  })

  it('should not mutate a previously proxied source graph', () => {
    type Node = { a?: Node; b?: Node; c?: Node }
    const source: Node = {}
    const first: Node = {}
    const second: Node = {}
    const third: Node = {}
    source.a = third
    source.c = second
    first.b = source
    first.c = source
    second.b = first
    third.b = second
    proxy(source)
    const current: Node = {}
    const shared: Node = {}
    current.a = shared
    current.c = shared
    const state = proxy({ node: current })
    const a = state.node.a
    const c = state.node.c

    state.node = source

    expect(state.node.a).not.toBe(a)
    expect(state.node.c).not.toBe(c)
    expect(state.node).toBe(proxy(source))
  })

  it('should leave the replaced raw target unchanged', () => {
    const raw = {}
    const first = proxy<{ node: { child?: { value: number } } }>({ node: raw })
    first.node = { child: { value: 1 } }
    const second = proxy({ node: { child: { value: 0 } } })

    second.node = raw as { child: { value: number } }

    expect(second.node).toBe(proxy(raw))
    expect(second.node.child).toBeUndefined()
    expect(first.node.child?.value).toBe(1)
  })

  it('should reuse current values of a previously proxied raw target', () => {
    type Node = { value: number; child?: { parent: Node } }
    const raw: Node = { value: 1 }
    raw.child = { parent: raw }
    const first = proxy({ node: { value: 0 } as Node })
    first.node = raw
    first.node.value = 99
    const current: Node = { value: 0 }
    current.child = { parent: current }
    const second = proxy({ node: current })

    second.node = raw

    expect(second.node.value).toBe(99)
    expect(second.node).toBe(first.node)
    expect(second.node.child?.parent).toBe(second.node)
  })

  it('should preserve raw topology through nested cycles', () => {
    type Node = { a?: Node; b?: Node; c?: Node }
    const current: Node = {}
    const tail: Node = {}
    const leaf: Node = {}
    current.b = current
    current.c = tail
    tail.c = leaf
    const next: Node = {}
    const child: Node = {}
    const nested: Node = {}
    next.b = nested
    next.c = next
    child.a = next
    nested.a = child
    nested.b = child
    nested.c = nested
    const state = proxy({ node: current })
    const b = state.node.b
    const c = state.node.c

    state.node = next

    expect(state.node.b).not.toBe(b)
    expect(state.node.c).not.toBe(c)
    expect(state.node.c).toBe(state.node)
    expect(state.node.b).not.toBe(state.node.c)
  })

  it('should preserve raw topology through cross-linked cycles', () => {
    type Node = { a?: Node; b?: Node; c?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const next: Node = {}
    const x: Node = {}
    const y: Node = {}
    const z: Node = {}
    next.a = z
    next.b = y
    x.a = x
    x.b = z
    y.a = z
    y.b = x
    y.c = y
    z.c = x
    const state = proxy({ node: current })
    const a = state.node.a
    const b = state.node.b

    state.node = next

    expect(state.node.a).not.toBe(a)
    expect(state.node.b).not.toBe(b)
    expect(state.node.b?.a).toBe(state.node.a)
  })

  it('should reuse an old cyclic proxy when assigned again', () => {
    type Node = { a?: Node; b?: Node }
    const current: Node = {}
    current.a = current
    current.b = current
    const next: Node = {}
    next.a = next
    next.b = {}
    const first = proxy({ node: current })
    first.node = next
    const second = proxy<{ node: Node }>({ node: { a: {}, b: {} } })
    const a = second.node.a

    second.node = current

    expect(second.node.a).not.toBe(a)
    expect(second.node.a).toBe(second.node)
    expect(second.node).toBe(proxy(current))
  })

  it('should preserve explicit proxies in an assigned cycle', () => {
    type Node = { b?: object; c?: Node }
    const current: Node = { b: {} }
    current.c = current
    const explicit = proxy({ tag: 1 })
    const state = proxy({ node: current })

    state.node = { b: explicit, c: {} }

    expect(state.node.b).toBe(explicit)
  })

  it('should change proxy topology with explicit proxies', () => {
    const state = proxy({ node: { a: { value: 1 }, b: { value: 1 } } })
    const shared = proxy({ value: 2 })

    state.node = { a: shared, b: shared }

    expect(state.node.a).toBe(shared)
    expect(state.node.b).toBe(shared)

    const wrapped = proxy(shared)
    state.node = { a: wrapped, b: wrapped }
    state.node = { a: shared, b: shared }

    expect(state.node.a).toBe(shared)
    expect(state.node.b).toBe(shared)

    state.node = {
      a: proxy({ value: 3 }),
      b: proxy({ value: 4 }),
    }

    expect(state.node.a).not.toBe(state.node.b)
    expect(state.node.a.value).toBe(3)
    expect(state.node.b.value).toBe(4)
  })

  it('should preserve explicitly retained raw proxy targets', () => {
    const raw = { value: 1 }
    const retained = proxy(raw)
    const state = proxy({
      node: { a: { value: 0 }, b: retained },
    })
    const node = state.node
    const a = state.node.a

    state.node = { a: raw, b: { value: 2 } }

    expect(state.node).not.toBe(node)
    expect(state.node.a).not.toBe(a)
    expect(state.node.a).toBe(retained)
    expect(state.node.b).not.toBe(retained)
    expect(retained.value).toBe(1)
    expect(state.node.a.value).toBe(1)
    expect(state.node.b.value).toBe(2)
  })

  it('should preserve assigned own-key order', () => {
    const first = Symbol()
    const second = Symbol()
    const state = proxy({
      node: { a: 1, b: 2, c: 3, [first]: 4, [second]: 5 },
    })
    const node = state.node

    state.node = { b: 2, a: 1, c: 3, [second]: 5, [first]: 4 }

    expect(state.node).not.toBe(node)
    const keys = ['b', 'a', 'c', second, first]
    expect(Reflect.ownKeys(state.node)).toEqual(keys)
    expect(Reflect.ownKeys(snapshot(state).node)).toEqual(keys)
  })

  it('should reorder undefined values', () => {
    const state = proxy({ node: { a: undefined, b: 1 } })

    state.node = { b: 1, a: undefined }

    expect(Object.keys(state.node)).toEqual(['b', 'a'])
  })

  it('should preserve shadowing properties while applying key order', () => {
    const state = proxy({
      node: JSON.parse('{"__proto__":1,"a":2}') as Record<string, number>,
    })

    state.node = JSON.parse('{"a":2,"__proto__":1}') as Record<string, number>

    expect(Object.keys(state.node)).toEqual(['a', '__proto__'])
    expect(Object.prototype.hasOwnProperty.call(state.node, '__proto__')).toBe(
      true,
    )
    expect(Object.getPrototypeOf(state.node)).toBe(Object.prototype)
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

  it('should preserve shared objects during proxy creation', () => {
    const shared = { count: 0 }
    const state = proxy({ root: { a: shared, b: shared } })
    expect(state.root.a).toBe(state.root.b)
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

  it('should preserve accessors in assigned objects', () => {
    let value = 1
    const state = proxy({ nested: { value: 0 } })
    const nextNested = {
      get value() {
        return value
      },
    }

    state.nested = nextNested
    expect(state.nested.value).toBe(1)
    expect(Object.getOwnPropertyDescriptor(state.nested, 'value')?.get).toBe(
      Object.getOwnPropertyDescriptor(nextNested, 'value')?.get,
    )

    value = 2
    expect(state.nested.value).toBe(2)
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
  it('should not enumerate existing keys when appending or growing length', () => {
    const raw = [0, 1, 2]
    const state = proxy(raw)
    const ownKeys = vi.spyOn(Reflect, 'ownKeys')
    try {
      for (let i = 0; i < 10; i++) {
        state.push(i)
      }
      state.length = 100
      expect(
        ownKeys.mock.calls.filter(([target]) => target === raw),
      ).toHaveLength(0)
    } finally {
      ownKeys.mockRestore()
    }
  })
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

  // The todo example removes an item with
  // `store.todos = store.todos.filter(...)`, replacing the array with a plain
  // copy whose members are already proxies.
  it('should preserve member identity when replaced by a filtered copy', async () => {
    const state = proxy({ items: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    const survivor = state.items[1]
    const handler = vi.fn()
    subscribe(state, handler)

    state.items = state.items.filter((item) => item.id !== 1)

    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
    expect(state.items.map((item) => item.id)).toEqual([2, 3])
    expect(state.items[0]).toBe(survivor)
    expect(snapshot(state)).toEqual({ items: [{ id: 2 }, { id: 3 }] })
  })

  it('should keep notifying through a member that survived the replacement', async () => {
    const state = proxy({
      items: [
        { id: 1, n: 0 },
        { id: 2, n: 0 },
      ],
    })
    state.items = state.items.filter((item) => item.id !== 1)

    const handler = vi.fn()
    subscribe(state, handler)

    state.items[0]!.n += 1
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
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

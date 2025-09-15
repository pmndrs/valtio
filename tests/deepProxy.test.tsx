import { describe, expect, it } from 'vitest'
import { proxy } from 'valtio'
import { deepProxy, proxyMap, proxySet } from 'valtio/utils'

describe('deepProxy', () => {
  // ProxySet tests
  it('should properly clone a proxySet', () => {
    const original = proxySet<number>([1, 2, 3])
    const cloned = deepProxy(original)

    // Check if values are the same
    expect([...cloned]).toEqual([...original])

    // Check if it's a different instance
    expect(cloned).not.toBe(original)

    // Check if it's still a proxySet (by checking methods)
    expect(typeof cloned.add).toBe('function')
    expect(typeof cloned.delete).toBe('function')
    expect(typeof cloned.clear).toBe('function')
    expect(typeof cloned[Symbol.iterator]).toBe('function')
    expect(Object.prototype.toString.call(cloned)).toBe('[object Set]')
  })

  it('should maintain proxySet reactivity', () => {
    const state = proxy({
      count: 0,
      set: proxySet<number>([1, 2, 3]),
    })

    const cloned = deepProxy(state)

    // Add a new item to the cloned set
    cloned.set.add(4)

    // Verify the item was added
    expect([...cloned.set]).toContain(4)

    // Verify it's still a reactive proxySet (we can check by seeing if add method throws an error)
    expect(() => cloned.set.add(5)).not.toThrow()
  })

  // ProxyMap tests
  it('should properly clone a proxyMap', () => {
    const original = proxyMap<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const cloned = deepProxy(original)

    // Check if values are the same
    expect([...cloned.entries()]).toEqual([...original.entries()])

    // Check if it's a different instance
    expect(cloned).not.toBe(original)

    // Check if it's still a proxyMap (by checking methods)
    expect(typeof cloned.set).toBe('function')
    expect(typeof cloned.get).toBe('function')
    expect(typeof cloned.delete).toBe('function')
    expect(typeof cloned.clear).toBe('function')
    expect(typeof cloned.entries).toBe('function')
    expect(Object.prototype.toString.call(cloned)).toBe('[object Map]')
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

    // Set a new entry in the cloned map
    cloned.map.set('c', 3)

    // Verify the entry was added
    expect(cloned.map.get('c')).toBe(3)

    // Verify it's still a reactive proxyMap (we can check by seeing if set method throws an error)
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

    // Check basic properties
    expect(cloned.name).toBe('test')
    expect(cloned.count).toBe(42)

    // Check proxySet
    expect([...cloned.set]).toEqual([1, 2, 3])

    // Check proxyMap
    expect(cloned.map.get('a')).toBe(1)
    expect(cloned.map.get('b')).toEqual({ nested: true })

    // Check nested proxySet inside proxyMap
    const nestedSet = cloned.map.get('c')
    expect([...nestedSet]).toEqual(['x', 'y', 'z'])
    expect(typeof nestedSet.add).toBe('function')

    // Check nested object with proxySet
    expect([...cloned.nested.anotherSet]).toEqual(['a', 'b', 'c'])

    // Verify reactivity is maintained
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

    // Verify they're still proxy collections
    expect(() => cloned.emptySet.add(1)).not.toThrow()
    expect(() => cloned.emptyMap.set('a', 1)).not.toThrow()
  })
})

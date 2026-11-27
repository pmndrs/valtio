import { describe, expect, it } from 'vitest'
import { proxy, ref, unstable_isRef } from 'valtio'
import { deepClone } from 'valtio/utils'

describe('deepClone', () => {
  // Basic data types
  it('should handle primitive values', () => {
    expect(deepClone(42)).toBe(42)
    expect(deepClone('hello')).toBe('hello')
    expect(deepClone(true)).toBe(true)
    expect(deepClone(null)).toBe(null)
    expect(deepClone(undefined)).toBe(undefined)
  })

  it('should clone plain objects', () => {
    const original = { a: 1, b: 'string', c: true }
    const cloned = deepClone(original)

    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original) // Different reference
  })

  it('should clone nested objects', () => {
    const original = {
      a: 1,
      b: {
        c: 'string',
        d: {
          e: true,
        },
      },
    }
    const cloned = deepClone(original)

    expect(cloned).toEqual(original)
    expect(cloned.b).not.toBe(original.b) // Different reference for nested objects
    expect(cloned.b.d).not.toBe(original.b.d)
  })

  it('should clone arrays', () => {
    const original = [1, 2, [3, 4, [5, 6]]]
    const cloned = deepClone(original)

    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    expect(cloned[2]).not.toBe(original[2])
  })

  // Valtio specific tests
  it('should clone proxy objects', () => {
    const original = proxy({ a: 1, b: 2 })
    const cloned = deepClone(original)

    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
  })

  it('should keep objects marked with ref by identity', () => {
    const inner = ref({ count: 0 })
    const original = { inner, nested: { inner } }
    const cloned = deepClone(original)

    expect(cloned.inner).toBe(inner)
    expect(cloned.nested.inner).toBe(inner)
  })

  it('should keep the objects a custom isRef selects, without marking them', () => {
    const inner = { count: 0 }
    const original = { inner, other: { count: 1 } }
    const cloned = deepClone(original, (x) => x === inner)

    expect(cloned.inner).toBe(inner)
    expect(cloned.other).not.toBe(original.other)
    expect(cloned.other).toEqual(original.other)
    expect(unstable_isRef(inner)).toBe(false)
  })
})

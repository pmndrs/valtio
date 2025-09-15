import { describe, expect, it } from 'vitest'
import { proxy } from 'valtio'
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
})

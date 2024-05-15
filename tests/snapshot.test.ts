import { createProxy, getUntracked } from 'proxy-compare'
import { TypeEqual, expectType } from 'ts-expect'
import { describe, expect, it } from 'vitest'
import { Snapshot, proxy, snapshot } from 'valtio'

it('should return correct snapshots without subscribe', async () => {
  const child = proxy({ count: 0 })
  const state = proxy({ child })

  expect(snapshot(state)).toEqual({ child: { count: 0 } })

  ++child.count
  expect(snapshot(state)).toEqual({ child: { count: 1 } })
})

it('should not change snapshot with assigning same object', async () => {
  const obj = {}
  const state = proxy({ obj })

  const snap1 = snapshot(state)
  state.obj = obj
  const snap2 = snapshot(state)
  expect(snap1).toBe(snap2)
})

it('should make the snapshot immutable', () => {
  const state = proxy<{ foo: number; bar?: string }>({ foo: 1 })
  const snap = snapshot(state)

  // Overwriting existing property
  expect(() => {
    ;(snap as typeof state).foo = 100
  }).toThrow()

  // Extension (adding new property)
  expect(() => {
    ;(snap as typeof state).bar = 'hello'
  }).toThrow()

  // Note: The current implementation does not prevent property removal.
  // Do not add a test for this unless we come up with an implementation that
  // supports it.
  // See https://github.com/pmndrs/valtio/issues/749
})

it('should not cause proxy-compare to copy', async () => {
  const state = proxy({ foo: 1 })
  const snap1 = snapshot(state)
  // Ensure configurable is true, otherwise proxy-compare will copy the object
  // so that its Proxy.get trap can work, and we don't want that perf overhead.
  expect(Object.getOwnPropertyDescriptor(snap1, 'foo')).toEqual({
    configurable: true,
    enumerable: true,
    value: 1,
    writable: false,
  })
  // Technically getUntracked is smart enough to not return the copy, so this
  // assertion doesn't strictly mean we avoided the copy
  const cmp = createProxy(snap1, new WeakMap())
  expect(getUntracked(cmp)).toBe(snap1)
})

it('should create a new proxy from a snapshot', async () => {
  const state = proxy({ c: 0 })
  const snap1 = snapshot(state)
  const state2 = proxy(snap1)
  expect(state2.c).toBe(0)
})

describe('snapsoht typings', () => {
  it('converts object properties to readonly', () => {
    expectType<
      TypeEqual<
        Snapshot<{
          string: string
          number: number
          null: null
          undefined: undefined
          bool: boolean
          someFunction(): number
          ref: { x: unknown } & { $$valtioSnapshot: { x: unknown } }
        }>,
        {
          readonly string: string
          readonly number: number
          readonly null: null
          readonly undefined: undefined
          readonly bool: boolean
          readonly someFunction: () => number
          readonly ref: { x: unknown }
        }
      >
    >(true)
  })

  it('converts arrays to readonly arrays', () => {
    expectType<TypeEqual<Snapshot<number[]>, readonly number[]>>(true)
  })

  it('keeps builtin objects from SnapshotIgnore as-is', () => {
    expectType<
      TypeEqual<
        Snapshot<{
          date: Date
          map: Map<string, unknown>
          set: Set<string>
          regexp: RegExp
          error: Error
          weakMap: WeakMap<any, any>
          weakSet: WeakSet<any>
        }>,
        {
          readonly date: Date
          readonly map: Map<string, unknown>
          readonly set: Set<string>
          readonly regexp: RegExp
          readonly error: Error
          readonly weakMap: WeakMap<any, any>
          readonly weakSet: WeakSet<any>
        }
      >
    >(true)
  })

  it('converts collections to readonly', () => {
    expectType<
      TypeEqual<
        Snapshot<{ key: string }[]>,
        readonly { readonly key: string }[]
      >
    >(true)
  })

  it('converts object properties to readonly recursively', () => {
    expectType<
      TypeEqual<
        Snapshot<{
          prevPage: number | null
          nextPage: number | null
          rows: number
          items: {
            title: string
            details: string | null
            createdAt: Date
            updatedAt: Date
          }[]
        }>,
        {
          readonly prevPage: number | null
          readonly nextPage: number | null
          readonly rows: number
          readonly items: readonly {
            readonly title: string
            readonly details: string | null
            readonly createdAt: Date
            readonly updatedAt: Date
          }[]
        }
      >
    >(true)
  })

  it('turns class fields to readonly', () => {
    class User {
      firstName!: string

      lastName!: string

      role!: string

      hasRole(role: string): boolean {
        return this.role === role
      }
    }

    const user = new User()

    expectType<
      TypeEqual<
        Snapshot<typeof user>,
        {
          readonly firstName: string
          readonly lastName: string
          readonly role: string
          readonly hasRole: (role: string) => boolean
        }
      >
    >(true)
  })

  it('ignores primitive types that have been branded/tagged', () => {
    const symbolTag = Symbol()
    expectType<
      TypeEqual<
        Snapshot<{
          brandedWithStringKey: string & { __brand: 'Brand' }
          brandedWithSymbolKey: number & { [symbolTag]: 'Tag' }
        }>,
        {
          readonly brandedWithStringKey: string & { __brand: 'Brand' }
          readonly brandedWithSymbolKey: number & { [symbolTag]: 'Tag' }
        }
      >
    >(true)
  })
})

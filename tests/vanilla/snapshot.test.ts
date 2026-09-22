import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { proxy, snapshot } from 'valtio'
import type { Snapshot } from 'valtio'

describe('snapshot', () => {
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

  it('should create a new proxy from a snapshot', async () => {
    const state = proxy({ c: 0 })
    const snap1 = snapshot(state)
    const state2 = proxy(snap1)
    expect(state2.c).toBe(0)
  })

  it('should not change snapshot with modifying the original proxy', async () => {
    const state = proxy({ obj1: {}, obj2: { nested: { count: 1 } } })
    const snap1 = snapshot(state)
    expect(snap1.obj1).toBeDefined()
    state.obj2.nested.count++
    const snap2 = snapshot(state)
    expect(snap1.obj2.nested.count).toBe(1)
    expect(snap2.obj2.nested.count).toBe(2)
  })

  it('should return stable nested snapshot object', async () => {
    const state = proxy({ count: 0, obj: {} })
    const snap1 = snapshot(state)
    state.count++
    const snap2 = snapshot(state)
    expect(snap2.obj).toBe(snap1.obj)
  })

  it('should preserve getters without evaluating or caching them', () => {
    const compute = vi.fn((count: number) => ({ doubled: count * 2 }))
    const state = proxy({
      count: 1,
      get info() {
        return compute(this.count)
      },
    })
    const snap = snapshot(state)

    expect(compute).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(snap, 'info')?.get).toBe(
      Object.getOwnPropertyDescriptor(state, 'info')?.get,
    )
    const first = snap.info
    const second = snap.info
    expect(first).toEqual({ doubled: 2 })
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(compute).toHaveBeenCalledTimes(2)
    expect(snapshot(state)).toBe(snap)
  })

  it('should evaluate previously unread getters against old snapshot data', () => {
    const state = proxy({
      nested: { count: 1 },
      get info() {
        return { nested: this.nested, doubled: this.nested.count * 2 }
      },
    })
    const snap = snapshot(state)
    state.nested.count = 2

    expect(snap.info).toEqual({ nested: { count: 1 }, doubled: 2 })
    expect(snap.info.nested).toBe(snap.nested)
    expect(snapshot(state).info.doubled).toBe(4)
  })

  it('should throw from getters only when they are read', () => {
    const state = proxy({
      get value(): number {
        throw new Error('getter error')
      },
    })
    const snap = snapshot(state)

    expect(() => snap.value).toThrow('getter error')
  })

  it('should omit setters from snapshot accessors', () => {
    const state = proxy({
      count: 1,
      get doubled() {
        return this.count * 2
      },
      set doubled(value: number) {
        this.count = value / 2
      },
    })
    const snap = snapshot(state)

    expect(Object.getOwnPropertyDescriptor(snap, 'doubled')?.get).toBeDefined()
    expect(
      Object.getOwnPropertyDescriptor(snap, 'doubled')?.set,
    ).toBeUndefined()
    expect(Reflect.set(snap, 'doubled', 4)).toBe(false)
    expect(state.count).toBe(1)
  })

  it('should preserve sparse array lengths before evaluating getters', () => {
    const values: number[] = []
    values.length = 3
    const state = proxy({
      values,
      get length() {
        return this.values.length
      },
    })

    const snap = snapshot(state)

    expect(snap.values.length).toBe(3)
    expect(snap.length).toBe(3)
  })

  it('[DEV-ONLY] should warn and throw for a non-proxy object', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => snapshot({} as any)).toThrow()
    expect(consoleWarn).toHaveBeenCalledWith('Please use proxy object')

    consoleWarn.mockRestore()
  })

  it('should evaluate getters that read ancestor properties in cyclic graphs', () => {
    type Root = {
      child: {
        parent: Root
        readonly selected: number
      }
      value: number
    }
    const root = {} as Root
    root.child = {
      parent: root,
      get selected() {
        return this.parent.value
      },
    }
    root.value = 1

    const snap = snapshot(proxy(root))

    expect(snap.child.selected).toBe(1)
  })

  it('should reuse the snapshot while the state is unchanged', () => {
    const state = proxy({ count: 0 })
    expect(snapshot(state)).toBe(snapshot(state))

    const snap1 = snapshot(state)
    state.count += 1
    expect(snapshot(state)).not.toBe(snap1)
  })

  it('should update all members of nested cycles without changing other snapshots', () => {
    type Root = {
      child: {
        inner: { parent: Root['child'] }
        outer: { root: Root }
      }
      value: { count: number }
      stable: { value: number }
    }
    const raw = {} as Root
    const child = {} as Root['child']
    raw.child = child
    raw.value = { count: 0 }
    raw.stable = { value: 1 }
    child.inner = { parent: child }
    child.outer = { root: raw }
    const state = proxy(raw)
    const previous = snapshot(state)

    state.value.count = 1
    const snap = snapshot(state)

    expect(snap.child.inner.parent.outer.root.value.count).toBe(1)
    expect(snap.child.inner.parent).toBe(snap.child)
    expect(snap.child.outer.root).toBe(snap)
    expect(snap.stable).toBe(previous.stable)
    expect(previous.child.inner.parent.outer.root.value.count).toBe(0)
    expect(snapshot(state)).toBe(snap)
  })

  it('should produce read-only properties', () => {
    const state = proxy({ count: 0 })
    const snap = snapshot(state)

    expect(() => {
      ;(snap as any).count = 1
    }).toThrow()
    expect(snap.count).toBe(0)
  })

  describe('snapshot typings', () => {
    it('converts object properties to readonly', () => {
      type A = Snapshot<{
        string: string
        number: number
        null: null
        undefined: undefined
        bool: boolean
        someFunction(): number
        ref: { x: unknown } & { $$valtioSnapshot: { x: unknown } }
      }>
      type B = {
        readonly string: string
        readonly number: number
        readonly null: null
        readonly undefined: undefined
        readonly bool: boolean
        readonly someFunction: () => number
        readonly ref: { x: unknown }
      }

      expectTypeOf<A>().toEqualTypeOf<B>()
    })

    it('converts arrays to readonly arrays', () => {
      type A = Snapshot<number[]>
      type B = readonly number[]

      expectTypeOf<A>().toEqualTypeOf<B>()
    })

    it('keeps builtin objects from SnapshotIgnore as-is', () => {
      type A = Snapshot<{
        date: Date
        map: Map<string, unknown>
        set: Set<string>
        regexp: RegExp
        error: Error
        weakMap: WeakMap<any, any>
        weakSet: WeakSet<any>
      }>
      type B = {
        readonly date: Date
        readonly map: Map<string, unknown>
        readonly set: Set<string>
        readonly regexp: RegExp
        readonly error: Error
        readonly weakMap: WeakMap<any, any>
        readonly weakSet: WeakSet<any>
      }

      expectTypeOf<A>().toEqualTypeOf<B>()
    })

    it('converts collections to readonly', () => {
      type A = Snapshot<{ key: string }[]>
      type B = readonly { readonly key: string }[]

      expectTypeOf<A>().toEqualTypeOf<B>()
    })

    it('converts object properties to readonly recursively', () => {
      type A = Snapshot<{
        prevPage: number | null
        nextPage: number | null
        rows: number
        items: {
          title: string
          details: string | null
          createdAt: Date
          updatedAt: Date
        }[]
      }>
      type B = {
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

      expectTypeOf<A>().toEqualTypeOf<B>()
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

      type A = Snapshot<typeof user>
      type B = {
        readonly firstName: string
        readonly lastName: string
        readonly role: string
        readonly hasRole: (role: string) => boolean
      }

      const user = new User()
      expect(user).toBeDefined()

      expectTypeOf<A>().toEqualTypeOf<B>()
    })

    it('ignores primitive types that have been branded/tagged', () => {
      const symbolTag = Symbol()

      type A = Snapshot<{
        brandedWithStringKey: string & { __brand: 'Brand' }
        brandedWithSymbolKey: number & { [symbolTag]: 'Tag' }
      }>
      type B = {
        readonly brandedWithStringKey: string & { __brand: 'Brand' }
        readonly brandedWithSymbolKey: number & { [symbolTag]: 'Tag' }
      }

      expectTypeOf<A>().toEqualTypeOf<B>()
    })
  })
})

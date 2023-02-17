import type { TypeEqual } from 'ts-expect'
import { expectType } from 'ts-expect'
import { INTERNAL_Snapshot as Snapshot } from 'valtio/vanilla'

// Converts object properties to readonly
expectType<
  TypeEqual<
    Snapshot<{
      string: string
      number: number
      null: null
      undefined: undefined
      bool: boolean
      someFunction(): number
      ref: {
        $$valtioRef: true
      }
    }>,
    {
      readonly string: string
      readonly number: number
      readonly null: null
      readonly undefined: undefined
      readonly bool: boolean
      readonly someFunction: () => number
      readonly ref: {
        $$valtioRef: true
      }
    }
  >
>(true)

// Infers Promise result from value
expectType<
  TypeEqual<
    Snapshot<{ promise: Promise<string> }>,
    { readonly promise: string }
  >
>(true)

// Converts arrays to readonly arrays
expectType<TypeEqual<Snapshot<number[]>, readonly number[]>>(true)

// Keeps builtin objects as-is. Date, Map, Set, WeakMap, WeakSet, Error and RegExp as the example.
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

// Converts collections to reaonly
expectType<
  TypeEqual<Snapshot<{ key: string }[]>, readonly { readonly key: string }[]>
>(true)

// Convets object properties to readonly recursively
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
        completions: {
          details: string
          completed: boolean
        }[]
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
        readonly completions: readonly {
          readonly details: string
          readonly completed: boolean
        }[]
      }[]
    }
  >
>(true)

class User {
  firstName!: string

  lastName!: string

  role!: string

  hasRole(role: string): boolean {
    return this.role === role
  }
}

const user = new User()

// Turns class fields to readonly
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

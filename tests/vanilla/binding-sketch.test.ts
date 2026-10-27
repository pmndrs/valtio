import { describe, expect, it } from 'vitest'
import { batch, proxy, subscribe } from 'valtio'

// A sketch of a CRDT binding on top of subscribe() without ops: one
// subscription per container, and a diff of the proxy against its mirror on
// each call. The mirror stands in for a Y.Array or a Y.Map: an item keeps its
// identity until it is deleted, and a move is a delete and an insert.

type Item = { value: unknown }

// Pairs of indices of a longest common subsequence. Object.is matches
// containers by identity and primitives by value.
const commonSubsequence = (a: unknown[], b: unknown[]) => {
  const lengths = a.map(() => b.map(() => 0))
  const at = (i: number, j: number) => lengths[i]?.[j] ?? 0
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i]![j] = Object.is(a[i], b[j])
        ? at(i + 1, j + 1) + 1
        : Math.max(at(i + 1, j), at(i, j + 1))
    }
  }
  const pairs: [number, number][] = []
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (Object.is(a[i], b[j])) {
      pairs.push([i++, j++])
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

const bindArray = (arr: unknown[]) => {
  const items: Item[] = arr.map((value) => ({ value }))
  let inserted = 0
  const unsubscribe = subscribe(arr, () => {
    const next = [...arr]
    // A common prefix and suffix are always part of a longest common
    // subsequence, so one contiguous edit costs no table.
    let start = 0
    while (
      start < items.length &&
      start < next.length &&
      Object.is(items[start]!.value, next[start])
    ) {
      start++
    }
    let end = 0
    while (
      end < items.length - start &&
      end < next.length - start &&
      Object.is(
        items[items.length - 1 - end]!.value,
        next[next.length - 1 - end],
      )
    ) {
      end++
    }
    const oldMiddle = items.slice(start, items.length - end)
    const newMiddle = next.slice(start, next.length - end)
    const kept = new Map(
      commonSubsequence(
        oldMiddle.map((item) => item.value),
        newMiddle,
      ).map(([i, j]) => [j, oldMiddle[i]!]),
    )
    const middle = newMiddle.map((value, j) => {
      const item = kept.get(j)
      if (item) {
        return item
      }
      inserted++
      return { value }
    })
    items.splice(start, oldMiddle.length, ...middle)
  })
  return {
    items,
    values: () => items.map((item) => item.value),
    inserted: () => inserted,
    unsubscribe,
  }
}

const bindMap = (obj: Record<string, unknown>) => {
  const entries = new Map(
    Object.entries(obj).map(([key, value]) => [key, { value }]),
  )
  const unsubscribe = subscribe(obj, () => {
    Object.keys(obj).forEach((key) => {
      const entry = entries.get(key)
      if (!entry || !Object.is(entry.value, obj[key])) {
        entries.set(key, { value: obj[key] })
      }
    })
    entries.forEach((_, key) => {
      if (!(key in obj)) {
        entries.delete(key)
      }
    })
  })
  return { entries, unsubscribe }
}

describe('a binding without ops', () => {
  it('round-trips a push', () => {
    const state = proxy([1, 2])
    const binding = bindArray(state)
    const [first, second] = binding.items

    state.push(3)

    expect(binding.values()).toEqual([1, 2, 3])
    expect(binding.items.slice(0, 2)).toEqual([first, second])
    expect(binding.inserted()).toBe(1)
  })

  it('round-trips an unshift of a value equal to the tail', () => {
    const state = proxy(['a', 'b', 'a'])
    const binding = bindArray(state)

    batch(() => state.unshift('a'))

    // which 'a' was inserted can't be recovered, but the values are right
    expect(binding.values()).toEqual(['a', 'a', 'b', 'a'])
    expect(binding.inserted()).toBe(1)
  })

  it('keeps the items of containers that a sort leaves in order', () => {
    const state = proxy([{ id: 3 }, { id: 1 }, { id: 2 }])
    const binding = bindArray(state)
    const [, one, two] = binding.items

    batch(() => state.sort((a, b) => a.id - b.id))

    expect(binding.values()).toEqual([...state])
    expect(binding.items.slice(0, 2)).toEqual([one, two])
    expect(binding.inserted()).toBe(1)
  })

  it('round-trips a sort that notifies once per internal write', () => {
    const state = proxy([{ id: 3 }, { id: 1 }, { id: 2 }, { id: 0 }])
    const binding = bindArray(state)

    state.sort((a, b) => a.id - b.id)

    expect(binding.values()).toEqual([...state])
  })

  it('round-trips two splices in one batch', () => {
    const state = proxy([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const binding = bindArray(state)
    const kept = binding.items.filter((_, i) => ![2, 6, 7].includes(i))

    batch(() => {
      state.splice(2, 1)
      state.splice(5, 2, 100)
    })

    expect(binding.values()).toEqual([0, 1, 3, 4, 5, 100, 8, 9])
    expect(binding.items.filter((item) => item.value !== 100)).toEqual(kept)
    expect(binding.inserted()).toBe(1)
  })

  it('keeps the items of containers when one is inserted before them', () => {
    const state = proxy([{ id: 1 }, { id: 2 }])
    const binding = bindArray(state)
    const before = [...binding.items]

    batch(() => state.unshift({ id: 0 }))

    expect(binding.values()).toEqual([...state])
    expect(binding.items.slice(1)).toEqual(before)
    expect(binding.inserted()).toBe(1)
  })

  it('round-trips map sets and deletes', () => {
    const state = proxy<Record<string, unknown>>({ a: 1, b: { c: 2 } })
    const binding = bindMap(state)
    const b = binding.entries.get('b')

    batch(() => {
      state.a = 2
      state.d = undefined
      delete state.a
      ;(state.b as { c: number }).c = 3
    })

    expect([...binding.entries.keys()]).toEqual(['b', 'd'])
    expect(binding.entries.get('b')).toBe(b)
    expect(binding.entries.get('d')).toEqual({ value: undefined })
  })
})

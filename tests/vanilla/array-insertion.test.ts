import { expect, it } from 'vitest'
import { proxy, snapshot } from 'valtio'

it('should preserve shifted objects when unshifting a raw object', () => {
  const state = proxy([{ id: 1 }, { id: 2 }])
  const first = state[0]
  const second = state[1]

  state.unshift({ id: 0 })

  expect(snapshot(state)).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }])
  expect(state[1]).toBe(first)
  expect(state[2]).toBe(second)
})

it('should preserve shifted objects when splicing a raw object', () => {
  const state = proxy([{ id: 1 }, { id: 2 }, { id: 3 }])
  const second = state[1]
  const third = state[2]

  state.splice(1, 0, { id: 0 })

  expect(snapshot(state)).toEqual([{ id: 1 }, { id: 0 }, { id: 2 }, { id: 3 }])
  expect(state[2]).toBe(second)
  expect(state[3]).toBe(third)
})

it('should preserve shifted objects when inserting an explicit proxy', () => {
  const state = proxy([{ id: 1 }, { id: 2 }])
  const first = state[0]
  const second = state[1]

  state.unshift(proxy({ id: 0 }))

  expect(snapshot(state)).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }])
  expect(state[1]).toBe(first)
  expect(state[2]).toBe(second)
})

it('should preserve removed objects when splicing a raw replacement', () => {
  const state = proxy([{ id: 1 }, { id: 2 }])
  const first = state[0]

  const removed = state.splice(0, 1, { id: 0 })

  expect(snapshot(state)).toEqual([{ id: 0 }, { id: 2 }])
  expect(removed[0]).toBe(first)
  expect(removed[0]?.id).toBe(1)
  expect(state[0]).not.toBe(first)
})

it('should replace a directly assigned array element', () => {
  const state = proxy([{ id: 1 }, { id: 2 }])
  const first = state[0]

  state[0] = { id: 0 }

  expect(state[0]).not.toBe(first)
  expect(first?.id).toBe(1)
})

it('should replace a directly assigned shared array element', () => {
  const shared = { id: 1 }
  const state = proxy([shared, shared])
  const first = state[0]

  state[0] = { id: 0 }

  expect(state[0]).not.toBe(first)
  expect(state[1]).toBe(first)
  expect(state[1]?.id).toBe(1)
})

it('should replace an element explicitly aliased at another array index', () => {
  const state = proxy([{ id: 1 }, { id: 2 }])
  const first = state[0]!
  state[1] = first

  state[0] = { id: 0 }

  expect(state[0]).not.toBe(first)
  expect(state[1]).toBe(first)
  expect(state[1]?.id).toBe(1)
})

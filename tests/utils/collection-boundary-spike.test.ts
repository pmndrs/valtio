import { expect, it } from 'vitest'
import { proxy, snapshot } from 'valtio/vanilla'
import { proxyMap, proxySet } from 'valtio/vanilla/utils'

it('should preserve initial Map order with duplicate entries', () => {
  const input: [string, number][] = [
    ['a', 1],
    ['b', 2],
    ['a', 3],
  ]
  const state = proxyMap(input)
  expect([...state]).toEqual([...new Map(input)])
  expect([...snapshot(state)]).toEqual([...new Map(input)])
})

it('should preserve initial Set order with repeated object members', () => {
  const first = { name: 'first' }
  const second = { name: 'second' }
  const state = proxySet([first, second, first])
  expect([...snapshot(state)].map((item) => item.name)).toEqual([
    'first',
    'second',
  ])
})

it('should preserve native key equality and order in collection snapshots', () => {
  const keys = [
    '__proto__',
    'toString',
    'constructor',
    1,
    '1',
    0,
    -0,
    NaN,
    null,
    undefined,
    false,
    Symbol(),
    Symbol.for('key'),
    {},
    () => {},
  ]
  const input = keys.map((key, index): [typeof key, number] => [key, index])
  const state = proxyMap(input)
  const expected = new Map(input)
  const snap = snapshot(state)
  keys.forEach((key) => {
    expect(snap.has(key)).toBe(true)
    expect(snap.get(key)).toBe(expected.get(key))
  })
  expect([...snap]).toEqual([...expected])
  state.clear()
  keys.forEach((key) => expect(snap.get(key)).toBe(expected.get(key)))
})

it('should keep wrapped collection indexes historical after deletion and reinsertion', () => {
  const collection = proxyMap([
    ['a', 1],
    ['b', 2],
  ])
  const state = proxy(proxy(collection))
  const snap = snapshot(state)
  collection.delete('a')
  collection.set('a', 3)
  expect([...snap]).toEqual([
    ['a', 1],
    ['b', 2],
  ])
  expect([...snapshot(state)]).toEqual([
    ['b', 2],
    ['a', 3],
  ])
})

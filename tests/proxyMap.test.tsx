import { StrictMode } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'
import { proxyMap } from 'valtio/utils/proxyMap'
import { proxySet } from 'valtio/utils'

const consoleError = console.error
beforeEach(() => {
  console.error = jest.fn((message) => {
    if (
      process.env.NODE_ENV === 'production' &&
      message.startsWith('act(...) is not supported in production')
    ) {
      return
    }

    consoleError(message)
  })
})
afterEach(() => {
  console.error = consoleError
})

it('features parity with native Map', () => {
  // contains all possible keys and values types
  const initialValue = [
    [-10, 1],
    ['hello', 'world'],
    [Symbol(), Symbol()],
    [false, true],
    [[10], [1, 2, 3]],
    [{}, { id: 'somehting', field: null }],
    [NaN, NaN],
    [() => {}, () => {}],
    [new ArrayBuffer(8), new ArrayBuffer(8)],
    [proxySet([{}]), proxySet([{}])],
  ]
  const map = proxyMap(initialValue as any)
  const nativeMap = new Map(initialValue as any)

  // check for Symbol.toStringTag / toString
  expect(`${map}`).toBe(`${nativeMap}`)

  const expectOutputToMatch = () => {
    expect(map.size).toStrictEqual(nativeMap.size)
    expect(Array.from(map.values())).toStrictEqual(
      Array.from(nativeMap.values())
    )
    expect(Array.from(map.keys())).toStrictEqual(Array.from(nativeMap.keys()))
    expect(Array.from(map.entries())).toStrictEqual(
      Array.from(nativeMap.entries())
    )
    expect(JSON.stringify(map)).toStrictEqual(JSON.stringify(nativeMap))

    // cover loops
    const handleForEach = jest.fn()
    const handleForOf = jest.fn()

    map.forEach(handleForEach)
    expect(handleForEach).toHaveBeenCalledTimes(map.size)

    for (const _ of map) {
      handleForOf()
    }

    expect(handleForOf).toHaveBeenCalledTimes(map.size)
  }

  expectOutputToMatch()

  const randomKey = Array.from(map.keys())[Math.floor(Math.random() * map.size)]

  expect(map.has(randomKey)).toBe(nativeMap.has(randomKey))

  map.delete(randomKey)
  nativeMap.delete(randomKey)
  expectOutputToMatch()

  map.set('newKey', {})
  nativeMap.set('newKey', {})
  expectOutputToMatch()
})

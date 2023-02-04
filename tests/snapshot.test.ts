import { expect, it } from '@jest/globals'
import { proxy, snapshot } from 'valtio'

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

it('getter returns value after promise is resolved', async () => {
  const state = proxy<any>({ status: sleep(10).then(() => 'done') })
  const snap = snapshot(state)

  await new Promise((resolve) => {
    resolve(snap.status)
  })
    .catch((thrown) => {
      expect(thrown).toBeInstanceOf(Promise)
      return thrown
    })
    .then((value) => {
      expect(value).toBe('done')
      expect(snap.status).toBe('done')
    })
})

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

it('should cache object getters', () => {
  let getter = 0
  const state = proxy({
    count: 1,
    get doubled() {
      getter++
      return this.count
    },
    set doubled(v: number) {
      this.count = v / 2
    },
  })

  // getter calls to the state are not cached
  state.doubled
  expect(getter).toBe(1)
  state.doubled
  expect(getter).toBe(2)

  // creating a snapshot caches the getter
  const snap = snapshot(state)
  expect(getter).toBe(3)
  expect(Reflect.ownKeys(snap)).toEqual(['count', 'doubled'])

  snap.doubled
  expect(getter).toBe(3)

  // and the setter will blow up
  expect(() => ((snap as any).doubled = 8)).toThrowError('Cannot assign')
})

it('should cache class getters', () => {
  let getter = 0
  class Counter {
    count = 1
    get doubled() {
      getter++
      return this.count * 2
    }
    set doubled(v: number) {
      this.count = v / 2
    }
  }
  const state = proxy(new Counter())

  // getter calls to the state are not cached
  state.doubled
  expect(getter).toBe(1)
  state.doubled
  expect(getter).toBe(2)

  // creating a snapshot caches the getter
  const snap = snapshot(state)
  expect(getter).toBe(3)
  expect(Reflect.ownKeys(snap)).toEqual(['count', 'doubled'])

  snap.doubled
  expect(getter).toBe(3)

  // and the setter will blow up
  expect(() => ((snap as any).doubled = 8)).toThrowError('Cannot assign')
})

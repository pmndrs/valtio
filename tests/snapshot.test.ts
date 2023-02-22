import { expect, it } from '@jest/globals'
import { createProxy, getUntracked } from 'proxy-compare'
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

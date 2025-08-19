import { describe, expect, it } from 'vitest'
import { proxy, snapshot, subscribe } from 'valtio'
import { subscribeKey } from 'valtio/utils'

const DEPTHS = [4, 8, 16, 32, 64, 128, 256]
const KEYS = [4, 8, 16, 32, 64, 128, 256, 512, 1024]
const REPEATS = 5000

const measurePerformance = (
  setUp: () => void,
  action: () => void,
  tearDown: () => void,
) => {
  const times: number[] = []
  setUp()
  for (let i = 0; i < REPEATS; i++) {
    const start = performance.now()
    action()
    times.push(performance.now() - start)
  }
  tearDown()
  times.sort((a, b) => a - b)
  const mid = Math.floor(times.length / 2)
  const median =
    times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2
  return median
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length

const logSlope = (xs: number[], ys: number[]) => {
  const lx = xs.map(Math.log)
  const ly = ys.map(Math.log)
  const mx = mean(lx)
  const my = mean(ly)
  let num = 0
  let den = 0
  for (let i = 0; i < lx.length; i++) {
    num += (lx[i]! - mx) * (ly[i]! - my)
    den += (lx[i]! - mx) ** 2
  }
  return num / den
}

const buildNestedObj = (depth: number) => {
  const leaf = { x: 1 }
  let obj: { child: unknown } = { child: leaf }
  for (let i = 1; i < depth; i++) {
    obj = { child: obj }
  }
  return { obj, leaf }
}

const buildManyKeysObj = (keys: number) => {
  const obj: { [key: string]: number } = {}
  for (let i = 0; i < keys; i++) {
    obj[`key${i}`] = 1
  }
  return obj
}

describe('performance with nested objects', () => {
  it('snapshot with subscription', async () => {
    const medians: number[] = []
    for (const depth of DEPTHS) {
      let unsub: (() => void) | undefined
      let proxyObj: object | undefined
      const median = measurePerformance(
        () => {
          const { obj, leaf } = buildNestedObj(depth)
          const proxyLeaf = proxy(leaf)
          proxyObj = proxy(obj)
          unsub = subscribe(proxyObj, () => {})
          snapshot(proxyObj)
          proxyLeaf.x++
        },
        () => {
          snapshot(proxyObj!)
        },
        () => {
          unsub?.()
        },
      )
      medians.push(median)
    }
    const slope = logSlope(DEPTHS, medians)
    expect(slope).toBeLessThan(0.1)
  })

  it('subscribeKey with many keys', async () => {
    const medians: number[] = []
    for (const key of KEYS) {
      let unsubs: (() => void)[] = []
      let proxyObj: any | undefined
      let firstKey: string | undefined
      const median = measurePerformance(
        () => {
          const obj = buildManyKeysObj(key)
          proxyObj = proxy(obj)
          for (const key in obj) {
            firstKey ??= key
            unsubs.push(subscribeKey(proxyObj, key, () => {}))
          }
          snapshot(proxyObj)
        },
        () => {
          proxyObj[firstKey!]++
        },
        () => {
          unsubs.forEach((unsub) => unsub())
          unsubs = []
          firstKey = undefined
        },
      )
      medians.push(median)
    }
    const slope = logSlope(KEYS, medians)
    expect(slope).toBeLessThan(0.1)
  })

  it('subscribeKey nested object with many times', async () => {
    const medians: number[] = []
    for (const key of KEYS) {
      let unsubs: (() => void)[] = []
      let proxyObj: any | undefined
      const median = measurePerformance(
        () => {
          const obj = { child: { x: 0 } }
          proxyObj = proxy(obj)
          for (let i = 0; i < key; i++) {
            unsubs.push(subscribeKey(proxyObj, `child`, () => {}))
          }
          snapshot(proxyObj)
        },
        () => {
          proxyObj.child.x++
        },
        () => {
          unsubs.forEach((unsub) => unsub())
          unsubs = []
        },
      )
      medians.push(median)
    }
    const slope = logSlope(KEYS, medians)
    expect(slope).toBeLessThan(0.1)
  })

  // TODO add more performance tests
})

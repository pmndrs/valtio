import { describe, expect, it } from 'vitest'
import { proxy, snapshot, subscribe } from 'valtio'

const DEPTHS = [4, 8, 16, 32, 64, 128, 256]
const REPEATS = 10000

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
  times.slice().sort((a, b) => a - b)
  const mid = Math.floor(times.length / 2)
  const median =
    times.length % 2 ? times[mid]! : (times[mid - 1]! + times[mid]!) / 2
  return median
}

const logSlope = (xs: number[], ys: number[]) => {
  // slope of log(ys) ~ m * log(xs) + b ; m≈0 means O(1), m≈1 means O(n)
  const lx = xs.map(Math.log)
  const ly = ys.map(Math.log)
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const mx = mean(lx),
    my = mean(ly)
  let num = 0,
    den = 0
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
    expect(slope).toBeLessThan(0.15)
  })

  // TODO add more performance tests
})

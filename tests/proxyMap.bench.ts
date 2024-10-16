/* eslint-disable vitest/consistent-test-it */
import { bench, describe, test } from 'vitest'
import { proxy, snapshot } from 'valtio'
import { proxyMap } from 'valtio/utils'

// Helper function to generate test data
function generateTestData(size: number): [number, number][] {
  const data: [any, any][] = []
  for (let i = 0; i < size; i++) {
    data.push([{ id: i }, { i }])
  }
  return data
}

const TEST_SIZES = [1000, 10_000, 100_000]

TEST_SIZES.forEach((size) => {
  describe.skip(`Insertion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })
  })

  describe.skip(`Insertion and Update -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.set(key, -1)
      })
    })
  })

  describe.skip(`Retrieval -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })
  })

  describe.skip(`Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })
  })

  describe.skip(`Iteration -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })
  })

  describe.skip(`Insertion, Retrieval, and Deletion -${size} items`, () => {
    const testData = generateTestData(size)
    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.get(key)
        map.delete(key)
      })
    })
  })

  describe.skip(`entries -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const [k, v] of map.entries()) {
        const _k = k
        const _v = v
      }
    })
  })

  describe.skip(`keys -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const k of map.keys()) {
        const _k = k
      }
    })
  })

  describe.skip(`values -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const v of map.values()) {
        const _v = v
      }
    })
  })

  describe.skip(`snapshot -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      const snap = snapshot(map)
      testData.forEach(([key, value]) => {
        snap.get(key)
      })
    })
  })

  describe(`snapshot & modify -${size} items`, () => {
    const testData = generateTestData(size)
    const oneData = generateTestData(1)[0]!

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      const snap1 = snapshot(map)
      map.set(oneData[0], oneData[1])
      const snap2 = snapshot(map)
    })
  })

  describe.skip('Clear -${size} items', () => {
    const testData = generateTestData(size)
    const map = proxyMap<number, number>(testData)

    bench('proxyMap', () => {
      map.clear()
    })
  })
})

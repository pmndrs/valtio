/* eslint-disable vitest/consistent-test-it */
import { bench, describe, test } from 'vitest'
import { snapshot } from 'valtio'
import { proxyMap } from 'valtio/utils'

// Helper function to generate test data
function generateTestData(size: number): [number, number][] {
  const data: [any, any][] = []
  for (let i = 0; i < size; i++) {
    data.push([{ id: i }, { i }])
  }
  return data
}

const TEST_SIZES = [1000]

TEST_SIZES.forEach((size) => {
  describe(`Insertion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })
  })

  describe(`Insertion and Update -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.set(key, -1)
      })
    })
  })

  describe(`Retrieval -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })
  })

  describe(`Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })
  })

  describe(`Iteration -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })
  })

  describe(`Insertion, Retrieval, and Deletion -${size} items`, () => {
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

  describe(`entries -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const [k, v] of map.entries()) {
        const _k = k
        const _v = v
      }
    })
  })

  describe(`keys -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const k of map.keys()) {
        const _k = k
      }
    })
  })

  describe(`values -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      for (const v of map.values()) {
        const _v = v
      }
    })
  })

  describe(`snapshot -${size} items`, () => {
    const testData = generateTestData(size)

    bench('proxyMap', () => {
      const map = proxyMap<number, number>(testData)
      const snap = snapshot(map)
      testData.forEach(([key, value]) => {
        snap.get(key)
      })
    })
  })
})

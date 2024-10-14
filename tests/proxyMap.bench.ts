/* eslint-disable vitest/consistent-test-it */
import { bench, describe } from 'vitest'
import {
  newProxyMap,
  newProxyMapKeyVals,
  newProxyMapRawMap1,
  newProxyMapTree1,
} from 'valtio/utils'

// Helper function to generate test data
function generateTestData(size: number): [number, number][] {
  const data: [any, any][] = []
  for (let i = 0; i < size; i++) {
    data.push([{ id: i }, { i }])
  }
  return data
}

const TEST_SIZES = [1000, 10000]

TEST_SIZES.forEach((size) => {
  describe(`Insertion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('Native proxyMap', () => {
      const map = new Map<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })

    bench('New proxyMapRawMap1', () => {
      const map = newProxyMapRawMap1<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })

    bench('New proxyMapTree1', () => {
      const map = newProxyMapTree1<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })
  })

  return

  describe(`Retrieval -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMap', () => {
      const map = newProxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })
  })

  describe(`Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMap', () => {
      const map = newProxyMap<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })
  })

  describe(`Iteration -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMap', () => {
      const map = newProxyMap<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })
  })

  describe(`Insertion, Retrieval, and Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMap', () => {
      const map = newProxyMap<number, number>(testData)
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.get(key)
        map.delete(key)
      })
    })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.get(key)
        map.delete(key)
      })
    })
  })
})

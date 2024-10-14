/* eslint-disable vitest/consistent-test-it */
import { bench, describe, test } from 'vitest'
import { snapshot } from 'valtio'
import { newProxyMapKeyVals, newProxyMapKeyVals2 } from 'valtio/utils'

// Helper function to generate test data
function generateTestData(size: number): [number, number][] {
  const data: [any, any][] = []
  for (let i = 0; i < size; i++) {
    data.push([{ id: i }, { i }])
  }
  return data
}

const TEST_SIZES = [1000, 10000, 30000]

TEST_SIZES.forEach((size) => {
  describe(`Insertion -${size} items`, () => {
    const testData = generateTestData(size)

    // bench('Native proxyMap', () => {
    //   const map = new Map<number, number>()
    //   testData.forEach(([key, value]) => {
    //     map.set(key, value)
    //   })
    // })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>()
      testData.forEach(([key, value]) => {
        map.set(key, value)
      })
    })
  })

  describe(`Retrieval -${size} items`, () => {
    const testData = generateTestData(size)

    // bench('Native Map', () => {
    //   const map = new Map<number, number>(testData)
    //   testData.forEach(([key]) => {
    //     map.get(key)
    //   })
    // })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      testData.forEach(([key]) => {
        map.get(key)
      })
    })
  })

  describe(`Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    // bench('Native Map', () => {
    //   const map = new Map<number, number>(testData)
    //   testData.forEach(([key]) => {
    //     map.delete(key)
    //   })
    // })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      testData.forEach(([key]) => {
        map.delete(key)
      })
    })
  })

  describe(`Iteration -${size} items`, () => {
    const testData = generateTestData(size)

    // bench('Native Map', () => {
    //   const map = new Map<number, number>(testData)
    //   testData.forEach(([key, value]) => {})
    // })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      testData.forEach(([key, value]) => {})
    })
  })

  describe(`Insertion, Retrieval, and Deletion -${size} items`, () => {
    const testData = generateTestData(size)

    // bench('New proxyMapKeyVals', () => {
    //   const map = new Map<number, number>(testData)
    //   testData.forEach(([key, value]) => {
    //     map.set(key, value)
    //     map.get(key)
    //     map.delete(key)
    //   })
    // })

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.get(key)
        map.delete(key)
      })
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      testData.forEach(([key, value]) => {
        map.set(key, value)
        map.get(key)
        map.delete(key)
      })
    })
  })

  describe(`entries -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      for (const [k, v] of map.entries()) {
        const _k = k
        const _v = v
      }
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      for (const [k, v] of map.entries()) {
        const _k = k
        const _v = v
      }
    })
  })

  describe(`keys -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      for (const k of map.keys()) {
        const _k = k
      }
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      for (const k of map.keys()) {
        const _k = k
      }
    })
  })

  describe(`values -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      for (const v of map.values()) {
        const _v = v
      }
    })
    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      for (const v of map.values()) {
        const _v = v
      }
    })
  })

  describe.only(`snapshot -${size} items`, () => {
    const testData = generateTestData(size)

    bench('New proxyMapKeyVals', () => {
      const map = newProxyMapKeyVals<number, number>(testData)
      const snap = snapshot(map)
      testData.forEach(([key, value]) => {
        snap.get(key)
      })
    })

    bench('New proxyMapKeyVals2', () => {
      const map = newProxyMapKeyVals2<number, number>(testData)
      const snap = snapshot(map)
      testData.forEach(([key, value]) => {
        snap.get(key)
      })
    })
  })
})

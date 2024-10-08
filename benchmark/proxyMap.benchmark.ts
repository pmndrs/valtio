import Benchmark from 'benchmark'
import { proxyMap as btreeProxyMap } from '../src/vanilla/utils/proxyMap-Btree.ts'
import { proxyMap as newProxyMap } from '../src/vanilla/utils/proxyMap.ts'

// Helper function to generate test data
function generateTestData(size: number): [number, number][] {
  const data: [number, number][] = []
  for (let i = 0; i < size; i++) {
    data.push([i, i])
  }
  return data
}

// Benchmark suite
const suite = new Benchmark.Suite()

// Test parameters
const TEST_SIZES = [1000, 10000, 100000]

TEST_SIZES.forEach((size) => {
  const testData = generateTestData(size)

  // Benchmark for insertion
  suite.add(`Insertion - Native Map (${size} items)`, () => {
    const map = new Map<number, number>()
    testData.forEach(([key, value]) => {
      map.set(key, value)
    })
  })

  // suite.add(`Insertion - New proxyMap (${size} items)`, () => {
  //   const map = newProxyMap<number, number>()
  //   testData.forEach(([key, value]) => {
  //     map.set(key, value)
  //   })
  // })

  suite.add(`Insertion - Btree proxyMap (${size} items)`, () => {
    const map = btreeProxyMap<number, number>()
    testData.forEach(([key, value]) => {
      map.set(key, value)
    })
  })

  // Benchmark for retrieval
  const nativeMap = new Map<number, number>(testData)
  const nProxyMap = newProxyMap<number, number>(testData)
  const bProxyMap = btreeProxyMap<number, number>(testData)

  suite.add(`Retrieval - Native Map (${size} items)`, () => {
    testData.forEach(([key]) => {
      nativeMap.get(key)
    })
  })

  // suite.add(`Retrieval - New proxyMap (${size} items)`, () => {
  //   testData.forEach(([key]) => {
  //     nProxyMap.get(key)
  //   })
  // })

  suite.add(`Retrieval - BTree proxyMap (${size} items)`, () => {
    testData.forEach(([key]) => {
      bProxyMap.get(key)
    })
  })

  // Benchmark for deletion
  suite.add(`Deletion - Native Map (${size} items)`, () => {
    const map = new Map<number, number>(testData)
    testData.forEach(([key]) => {
      map.delete(key)
    })
  })

  // suite.add(`Deletion - New proxyMap (${size} items)`, () => {
  //   const map = newProxyMap<number, number>(testData)
  //   testData.forEach(([key]) => {
  //     map.delete(key)
  //   })
  // })

  suite.add(`Deletion - BTree proxyMap (${size} items)`, () => {
    const map = btreeProxyMap<number, number>(testData)
    testData.forEach(([key]) => {
      map.delete(key)
    })
  })

  // Benchmark for iteration
  suite.add(`Iteration - Native Map (${size} items)`, () => {
    for (const [key, value] of nativeMap) {
      // No-op
    }
  })

  // suite.add(`Iteration - New proxyMap (${size} items)`, () => {
  //   for (const [key, value] of nProxyMap) {
  //     // No-op
  //   }
  // })

  suite.add(`Iteration - Btree proxyMap (${size} items)`, () => {
    for (const [key, value] of bProxyMap) {
      // No-op
    }
  })
})

// Run the benchmarks
suite
  .on('cycle', function (event: any) {
    console.log(String(event.target))
  })
  .on('complete', function (this: Benchmark.Suite) {
    console.log('\nFastest is ' + this.filter('fastest').map('name'))
  })
  .run({ async: true })

import Benchmark from 'benchmark'
import { deepClone } from '../src/vanilla/utils/deepClone.ts'
import { proxyMap as btreeProxyMap } from '../src/vanilla/utils/proxyMap-btree.ts'
import { proxyMap as chunkedProxyMap } from '../src/vanilla/utils/proxyMap-chunked.ts'
import { proxyMap as newProxyMap } from '../src/vanilla/utils/proxyMap-indexMap.ts'

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
const TEST_SIZES = [1000, 10000, 30000]

TEST_SIZES.forEach((size) => {
  const testData = generateTestData(size)

  // Benchmark for insertion
  suite.add(`Insertion - Native Map (${size} items)`, () => {
    const map = new Map<number, number>()
    testData.forEach(([key, value]) => {
      map.set(key, value)
    })
  })

  const MIN_SIZES = [0, 1000, 10000, 30000]
  MIN_SIZES.forEach((minSize) => {
    suite.add(
      `Insertion - New proxyMap (${size} items) (minSize=${minSize})`,
      () => {
        const map = newProxyMap<number, number>(null, { minSize })
        testData.forEach(([key, value]) => {
          map.set(key, value)
        })
      },
    )
  })

  // suite.add(`Insertion - Chunked proxyMap (${size} items)`, () => {
  //   const map = chunkedProxyMap<number, number>()
  //   testData.forEach(([key, value]) => {
  //     map.set(key, value)
  //   })
  // })

  // suite.add(`Insertion - Btree proxyMap (${size} items)`, () => {
  //   const map = btreeProxyMap<number, number>()
  //   testData.forEach(([key, value]) => {
  //     map.set(key, value)
  //   })
  // })

  //   // Benchmark for retrieval
  //   const nativeMap = new Map<number, number>(testData)
  //   const nProxyMap = newProxyMap<number, number>(testData)
  //   const bProxyMap = btreeProxyMap<number, number>(testData)

  //   suite.add(`Retrieval - Native Map (${size} items)`, () => {
  //     testData.forEach(([key]) => {
  //       nativeMap.get(key)
  //     })
  //   })

  //   suite.add(`Retrieval - New proxyMap (${size} items)`, () => {
  //     testData.forEach(([key]) => {
  //       nProxyMap.get(key)
  //     })
  //   })

  //   suite.add(`Retrieval - BTree proxyMap (${size} items)`, () => {
  //     testData.forEach(([key]) => {
  //       bProxyMap.get(key)
  //     })
  //   })

  //   // Benchmark for deletion
  //   suite.add(`Deletion - Native Map (${size} items)`, () => {
  //     const map = new Map<number, number>(deepClone(testData))
  //     testData.forEach(([key]) => {
  //       map.delete(key)
  //     })
  //   })

  //   suite.add(`Deletion - New proxyMap (${size} items)`, () => {
  //     const map = newProxyMap<number, number>(deepClone(testData))
  //     testData.forEach(([key]) => {
  //       map.delete(key)
  //     })
  //   })

  //   suite.add(`Deletion - BTree proxyMap (${size} items)`, () => {
  //     const map = btreeProxyMap<number, number>(deepClone(testData))
  //     testData.forEach(([key]) => {
  //       map.delete(key)
  //     })
  //   })

  //   // Benchmark for iteration
  //   suite.add(`Iteration - Native Map (${size} items)`, () => {
  //     for (const [key, value] of nativeMap) {
  //       // No-op
  //     }
  //   })

  //   suite.add(`Iteration - New proxyMap (${size} items)`, () => {
  //     for (const [key, value] of nProxyMap) {
  //       // No-op
  //     }
  //   })

  //   suite.add(`Iteration - Btree proxyMap (${size} items)`, () => {
  //     for (const [key, value] of bProxyMap) {
  //       // No-op
  //     }
  //   })

  // suite.add(
  //   `Insertion, Retrieval, and Deletion - Native Map (${size} items)`,
  //   () => {
  //     const map = new Map<number, number>(deepClone(testData))
  //     testData.forEach(([key, value]) => {
  //       map.set(key, value)
  //       map.get(key)
  //       map.delete(key)
  //     })
  //   },
  // )

  // suite.add(
  //   `Insertion, Retrieval, and Deletion - New ProxyMap (${size} items)`,
  //   () => {
  //     const map = newProxyMap<number, number>(deepClone(testData))
  //     testData.forEach(([key, value]) => {
  //       map.set(key, value)
  //       map.get(key)
  //       map.delete(key)
  //     })
  //   },
  // )

  // suite.add('Insertion, Retrieval, and Deletion - Btree ProxyMap', () => {
  //   const map = btreeProxyMap<number, number>(deepClone(testData))
  //   testData.forEach(([key, value]) => {
  //     map.set(key, value)
  //     map.get(key)
  //     map.delete(key)
  //   })
  // })

  // suite.add(
  //   `Insertion, Retrieval, and Deletion - Chunked ProxyMap (${size} items)`,
  //   () => {
  //     const map = chunkedProxyMap<number, number>(deepClone(testData))
  //     testData.forEach(([key, value]) => {
  //       map.set(key, value)
  //       map.get(key)
  //       map.delete(key)
  //     })
  //   },
  // )
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

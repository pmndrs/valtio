import { proxySet as originalProxySet } from '../src/vanilla/utils/proxySet.old'
import { proxySet as newProxySet } from '../src/vanilla/utils/proxySet'
import Benchmark from 'benchmark'

// Helper function to generate test data
function generateTestData(size: number): number[] {
  const data: number[] = []
  for (let i = 0; i < size; i++) {
    data.push(i)
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
  suite.add(`Insertion - Native Set (${size} items)`, () => {
    const set = new Set<number>()
    testData.forEach((value) => {
      set.add(value)
    })
  })

  suite.add(`Insertion - Original proxySet (${size} items)`, () => {
    const set = originalProxySet<number>()
    testData.forEach((value) => {
      set.add(value)
    })
  })

  suite.add(`Insertion - New proxySet (${size} items)`, () => {
    const set = newProxySet<number>()
    testData.forEach((value) => {
      set.add(value)
    })
  })

  // Benchmark for checking existence
  const nativeSet = new Set<number>(testData)
  const origProxySet = originalProxySet<number>(testData)
  const nProxySet = newProxySet(testData)

  suite.add(`Has Check - Native Set (${size} items)`, () => {
    testData.forEach((value) => {
      nativeSet.has(value)
    })
  })

  suite.add(`Has Check - Original proxySet (${size} items)`, () => {
    testData.forEach((value) => {
      origProxySet.has(value)
    })
  })

  suite.add(`Has Check - New proxySet (${size} items)`, () => {
    testData.forEach((value) => {
      nProxySet.has(value)
    })
  })

  // Benchmark for deletion
  suite.add(`Deletion - Native Set (${size} items)`, () => {
    const set = new Set<number>(testData)
    testData.forEach((value) => {
      set.delete(value)
    })
  })

  suite.add(`Deletion - Original proxySet (${size} items)`, () => {
    const set = originalProxySet<number>(testData)
    testData.forEach((value) => {
      set.delete(value)
    })
  })

  suite.add(`Deletion - New proxySet (${size} items)`, () => {
    const set = newProxySet<number>(testData)
    testData.forEach((value) => {
      set.delete(value)
    })
  })

  // Benchmark for iteration
  suite.add(`Iteration - Native Set (${size} items)`, () => {
    for (const value of nativeSet) {
      // No-op
    }
  })

  suite.add(`Iteration - Original proxySet (${size} items)`, () => {
    for (const value of origProxySet) {
      // No-op
    }
  })

  suite.add(`Iteration - New proxySet (${size} items)`, () => {
    for (const value of nProxySet) {
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

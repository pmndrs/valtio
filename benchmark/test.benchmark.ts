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

// Function to perform deletion using 'delete' operator
function deleteElements(array: number[], indices: number[]) {
  for (const index of indices) {
    delete array[index]
  }
}

// Function to set elements to 'undefined'
function setElementsToUndefined(
  array: (number | undefined)[],
  indices: number[],
) {
  for (const index of indices) {
    array[index] = undefined
  }
}

// Function to iterate over array using 'forEach'
function iterateArray(array: (number | undefined)[]) {
  let sum = 0
  array.forEach((value) => {
    if (value !== undefined) {
      sum += value
    }
  })
  return sum
}

TEST_SIZES.forEach((size) => {
  const testData = generateTestData(size)
  const indicesToRemove: number[] = []

  // Generate random indices to remove
  for (let i = 0; i < size / 10; i++) {
    indicesToRemove.push(Math.floor(Math.random() * size))
  }

  suite.add(`Delete Operator (${size} items)`, () => {
    const array = [...testData]
    deleteElements(array, indicesToRemove)
  })

  suite.add(`Set to Undefined (${size} items)`, () => {
    const array = [...testData]
    setElementsToUndefined(array, indicesToRemove)
  })

  suite.add(`Iteration After Delete (${size} items)`, () => {
    const array = [...testData]
    deleteElements(array, indicesToRemove)
    iterateArray(array)
  })

  suite.add(`Iteration After Setting Undefined (${size} items)`, () => {
    const array = [...testData]
    setElementsToUndefined(array, indicesToRemove)
    iterateArray(array)
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

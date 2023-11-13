import { StrictMode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { it } from 'vitest'
import { useSnapshot } from 'valtio'
import { proxyWithHistory } from 'valtio/utils'

it('simple count', async () => {
  const state = proxyWithHistory(0)

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value}</div>
        <button onClick={() => ++state.value}>inc</button>
        <button onClick={snap.undo}>undo</button>
        <button onClick={snap.redo}>redo</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('inc'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('redo'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')
})

it('count in object', async () => {
  const state = proxyWithHistory({ count: 0 })

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value.count}</div>
        <button onClick={() => ++state.value.count}>inc</button>
        <button onClick={snap.undo}>undo</button>
        <button onClick={snap.redo}>redo</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('inc'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('redo'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')
})

it('count in nested object', async () => {
  const state = proxyWithHistory({ nested: { count: 0 } })

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value.nested.count}</div>
        <button onClick={() => ++state.value.nested.count}>inc</button>
        <button onClick={snap.undo}>undo</button>
        <button onClick={snap.redo}>redo</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('inc'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('redo'))
  await findByText('count: 3')

  fireEvent.click(getByText('undo'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')

  fireEvent.click(getByText('undo'))
  await findByText('count: 0')
})

it('multiple redos at once (#323)', async () => {
  const state = proxyWithHistory({ nested: { count: 0 } })

  const Counter = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>count: {snap.value.nested.count}</div>
        <button onClick={() => ++state.value.nested.count}>inc</button>
        <button
          onClick={() => {
            state.undo()
            state.undo()
          }}
        >
          undo twice
        </button>
        <button
          onClick={() => {
            state.redo()
            state.redo()
          }}
        >
          redo twice
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await findByText('count: 0')

  fireEvent.click(getByText('inc'))
  await findByText('count: 1')
  fireEvent.click(getByText('inc'))
  await findByText('count: 2')

  fireEvent.click(getByText('undo twice'))
  await findByText('count: 0')

  fireEvent.click(getByText('redo twice'))
  await findByText('count: 2')
})

it('nested array (#516)', async () => {
  interface Level1Interface {
    level1Values: number[]
  }
  interface Level0Interface {
    level0Values: Level1Interface[]
  }
  const state = proxyWithHistory<Level0Interface>({
    level0Values: [{ level1Values: [0, 1] }, { level1Values: [2, 3] }],
  })

  const NestedArray = () => {
    const snap = useSnapshot(state)
    return (
      <>
        <div>values: {JSON.stringify(snap.value)}</div>
        <button
          onClick={() => {
            state.undo()
          }}
        >
          undo
        </button>
        <button
          onClick={() => {
            if (state.value.level0Values[1]) {
              state.value.level0Values[1].level1Values[0] = 10
            }
          }}
        >
          change 2 to 10
        </button>
        <button
          onClick={() => {
            if (state.value.level0Values[1]) {
              state.value.level0Values[1].level1Values[0] = 11
            }
          }}
        >
          change 10 to 11
        </button>
        <button
          onClick={() => {
            if (state.value.level0Values[0]) {
              state.value.level0Values[0].level1Values[0] = 12
            }
          }}
        >
          change 0 to 12
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <NestedArray />
    </StrictMode>,
  )

  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[2,3]}]}',
  )

  fireEvent.click(getByText('change 2 to 10'))
  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[10,3]}]}',
  )

  fireEvent.click(getByText('change 10 to 11'))
  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[11,3]}]}',
  )

  fireEvent.click(getByText('undo')) // => 11 back to 10
  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[10,3]}]}',
  )

  fireEvent.click(getByText('change 0 to 12'))
  await findByText(
    'values: {"level0Values":[{"level1Values":[12,1]},{"level1Values":[10,3]}]}',
  )

  fireEvent.click(getByText('undo')) // => 12 back to 0
  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[10,3]}]}',
  )

  fireEvent.click(getByText('undo')) // => 10 back to 2
  await findByText(
    'values: {"level0Values":[{"level1Values":[0,1]},{"level1Values":[2,3]}]}',
  )
})

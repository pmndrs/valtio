import { StrictMode, useEffect, useRef } from 'react'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react'
import { proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'

it('should trigger re-render setting objects with ref wrapper', async () => {
  const obj = proxy({ nested: ref({ count: 0 }) })

  const Counter = () => {
    const snap = useSnapshot(obj)
    const commitsRef = useRef(1)
    useEffect(() => {
      commitsRef.current += 1
    })
    return (
      <>
        <div>
          count: {snap.nested.count} ({commitsRef.current})
        </div>
        <button onClick={() => (obj.nested = ref({ count: 0 }))}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <>
      <Counter />
    </>
  )

  await findByText('count: 0 (1)')

  fireEvent.click(getByText('button'))
  await findByText('count: 0 (2)')
})

it('should not track object wrapped in ref assigned to proxy state', async () => {
  const obj = proxy<{ ui: JSX.Element | null }>({ ui: null })

  const Component = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        {snap.ui || <span>original</span>}
        <button onClick={() => (obj.ui = ref(<span>replace</span>))}>
          button
        </button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Component />
    </StrictMode>
  )

  await findByText('original')

  fireEvent.click(getByText('button'))
  await findByText('replace')
})

it('should not trigger re-render when mutating object wrapped in ref', async () => {
  const obj = proxy({ nested: ref({ count: 0 }) })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>count: {snap.nested.count}</div>
        <button onClick={() => ++obj.nested.count}>button</button>
      </>
    )
  }

  const { getByText, findByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 0')

  fireEvent.click(getByText('button'))
  await findByText('count: 0')
})

it('should not update snapshot or notify subscription when mutating proxy wrapped in ref', async () => {
  const obj = proxy({ nested: ref(proxy({ count: 0 })) })

  const snap1 = snapshot(obj)
  ++obj.nested.count
  const snap2 = snapshot(obj)
  expect(snap2).toBe(snap1)

  const callback = jest.fn()
  subscribe(obj, callback)
  ++obj.nested.count
  await Promise.resolve()
  expect(callback).not.toBeCalled()
})

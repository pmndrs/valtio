import { StrictMode, useEffect, useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { proxy, ref, snapshot, subscribe, useSnapshot } from 'valtio'

const useCommitCount = () => {
  const commitCountRef = useRef(1)
  useEffect(() => {
    commitCountRef.current += 1
  })
  // eslint-disable-next-line react-compiler/react-compiler
  return commitCountRef.current
}

it('should trigger re-render setting objects with ref wrapper', async () => {
  const obj = proxy({ nested: ref({ count: 0 }) })

  const Counter = () => {
    const snap = useSnapshot(obj)
    return (
      <>
        <div>
          count: {snap.nested.count} ({useCommitCount()})
        </div>
        <button onClick={() => (obj.nested = ref({ count: 0 }))}>button</button>
      </>
    )
  }

  render(
    <>
      <Counter />
    </>,
  )

  await screen.findByText('count: 0 (1)')

  fireEvent.click(screen.getByText('button'))
  await screen.findByText('count: 0 (2)')
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

  render(
    <StrictMode>
      <Component />
    </StrictMode>,
  )

  await screen.findByText('original')

  fireEvent.click(screen.getByText('button'))
  await screen.findByText('replace')
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

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  await screen.findByText('count: 0')

  fireEvent.click(screen.getByText('button'))
  await screen.findByText('count: 0')
})

it('should not update snapshot or notify subscription when mutating proxy wrapped in ref', async () => {
  const obj = proxy({ nested: ref(proxy({ count: 0 })) })

  const snap1 = snapshot(obj)
  ++obj.nested.count
  const snap2 = snapshot(obj)
  expect(snap2).toBe(snap1)

  const callback = vi.fn()
  subscribe(obj, callback)
  ++obj.nested.count
  await Promise.resolve()
  expect(callback).not.toBeCalled()
})

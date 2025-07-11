import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

it('unsupported map', async () => {
  const obj = proxy({ map: new Map([['count', 0]]) })

  const Counter = () => {
    const snap = useSnapshot(obj) as any
    return (
      <>
        <div>count: {snap.map.get('count')}</div>
        <button onClick={() => obj.map.set('count', 1)}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  expect(screen.getByText('count: 0')).toBeInTheDocument()

  fireEvent.click(screen.getByText('button'))
  expect(() => screen.getByText('count: 1')).toThrow()
})

it('unsupported set', async () => {
  const obj = proxy({ set: new Set([1, 2, 3]) })

  const Counter = () => {
    const snap = useSnapshot(obj) as any
    return (
      <>
        <div>count: {[...snap.set].join(',')}</div>
        <button onClick={() => obj.set.add(4)}>button</button>
      </>
    )
  }

  render(
    <StrictMode>
      <Counter />
    </StrictMode>,
  )

  expect(screen.getByText('count: 1,2,3')).toBeInTheDocument()

  fireEvent.click(screen.getByText('button'))
  expect(() => screen.getByText('count: 1,2,3,4')).toThrow()
})

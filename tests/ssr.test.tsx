import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('ssr', () => {
  it('should return snapshot via getServerSnapshot with renderToString', () => {
    const obj = proxy({ count: 0 })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return <div>count: {snap.count}</div>
    }

    const view = renderToString(
      <StrictMode>
        <Counter />
      </StrictMode>,
    )

    expect(view).toContain('count:')
    expect(view).toContain('0')
  })
})

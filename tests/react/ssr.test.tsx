import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('server rendering', () => {
  it('should render the current snapshot', () => {
    const obj = proxy({ count: 1 })

    const Counter = () => {
      const snap = useSnapshot(obj)
      return <div>{`count: ${snap.count}`}</div>
    }

    expect(renderToString(<Counter />)).toContain('count: 1')
  })

  it('should render nested state', () => {
    const obj = proxy({ nested: { text: 'hello' } })

    const Text = () => {
      const snap = useSnapshot(obj)
      return <div>{snap.nested.text}</div>
    }

    expect(renderToString(<Text />)).toContain('hello')
  })
})

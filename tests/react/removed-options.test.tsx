import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { proxy, useSnapshot } from 'valtio'
import { useProxy } from 'valtio/utils'

describe('removed options', () => {
  it('should throw when useSnapshot receives an options argument', () => {
    const state = proxy({ count: 0 })
    expect(() => (useSnapshot as any)(state, { sync: true })).toThrow(
      'useSnapshot() no longer accepts an options argument. Updates are synchronous.',
    )
  })

  it('should throw when useProxy receives an options argument', () => {
    const state = proxy({ count: 0 })
    expect(() => (useProxy as any)(state, { sync: true })).toThrow(
      'useProxy() no longer accepts an options argument. Updates are synchronous.',
    )
  })

  it('should accept an explicit undefined', () => {
    const state = proxy({ count: 0 })
    const Component = () => {
      const tracked = (useSnapshot as any)(state, undefined)
      const store = (useProxy as any)(state, undefined)
      return (
        <div>
          count: {tracked.count} {store.count}
        </div>
      )
    }
    render(<Component />)
    expect(screen.getByText('count: 0 0')).toBeInTheDocument()
  })
})

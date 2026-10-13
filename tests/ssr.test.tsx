import { StrictMode } from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy, useSnapshot } from 'valtio'

describe('ssr', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should return initial snapshot in SSR', () => {
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

  it('should return the latest snapshot after proxy state changes', () => {
    const obj = proxy({ count: 0 })

    obj.count = 5

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
    expect(view).toContain('5')
  })

  it('should not cause hydration mismatch', async () => {
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

    const container = document.createElement('div')
    container.innerHTML = view
    document.body.appendChild(container)

    const errorSpy = vi.spyOn(console, 'error')

    await act(() =>
      hydrateRoot(
        container,
        <StrictMode>
          <Counter />
        </StrictMode>,
      ),
    )

    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { proxy, unstable_getInternalStates, useSnapshot } from 'valtio'

it.each([10, 1000])(
  'should register only the read leaf with %s children',
  (size) => {
    const state = proxy({
      items: Array.from({ length: size }, () => ({ count: 1 })),
    })
    const { proxyStateMap } = unstable_getInternalStates()
    const states = [state, state.items, ...state.items]
    const recursive = states.map((state) =>
      vi.spyOn(proxyStateMap.get(state)!, '2'),
    )
    const keyed = states.map((state) =>
      vi.spyOn(proxyStateMap.get(state)!, '3'),
    )
    try {
      const Component = () => <div>{useSnapshot(state).items[0]!.count}</div>
      const { unmount } = render(<Component />)
      expect(
        recursive.reduce((count, spy) => count + spy.mock.calls.length, 0),
      ).toBe(0)
      expect(
        keyed.reduce((count, spy) => count + spy.mock.calls.length, 0),
      ).toBe(1)
      expect(keyed[2]).toHaveBeenCalledWith(
        'count',
        expect.any(Function),
        false,
      )
      unmount()
    } finally {
      recursive.forEach((spy) => spy.mockRestore())
      keyed.forEach((spy) => spy.mockRestore())
    }
  },
)

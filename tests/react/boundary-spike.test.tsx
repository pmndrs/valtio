import { act, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  proxy,
  ref,
  snapshot,
  subscribe,
  unstable_replaceInternalFunction,
} from 'valtio/vanilla'

it('should not replace snapshot creation when loading React or collections', async () => {
  let original: any
  let installed: any
  unstable_replaceInternalFunction('createSnapshot', (prev) => {
    original = prev
    installed = (target: object, version: number) => prev(target, version)
    return installed
  })
  try {
    await import('valtio/react')
    await import('valtio/vanilla/utils')
    unstable_replaceInternalFunction('createSnapshot', (current) => {
      expect(current).toBe(installed)
      return current
    })
  } finally {
    unstable_replaceInternalFunction('createSnapshot', () => original)
  }
})

it('should distinguish an observed child from a later ref of its snapshot', async () => {
  const { useSnapshot } = await import('valtio/react')
  const child = proxy({ count: 1 })
  const state = proxy({ child })
  const oldSnapshot = snapshot(child)
  const renders = vi.fn()
  let latest: object | undefined
  const Component = () => {
    const tracked = useSnapshot(state)
    latest = tracked.child
    renders(tracked.child.count)
    return null
  }
  render(<Component />)
  await act(async () => {
    state.child = ref(oldSnapshot)
  })
  expect(latest).toBe(oldSnapshot)
  expect(renders).toHaveBeenCalledTimes(2)
  await act(async () => {
    child.count = 2
  })
  expect(renders).toHaveBeenCalledTimes(2)
})

it('should make recursive key subscription an explicit choice', () => {
  const state = proxy({ child: { count: 1 } })
  const direct = vi.fn()
  const recursive = vi.fn()
  const stopDirect = subscribe(state, direct, {
    keys: ['child'],
    recursive: false,
    sync: true,
  })
  const stopRecursive = subscribe(state, recursive, {
    keys: ['child'],
    sync: true,
  })
  state.child.count++
  expect(direct).not.toHaveBeenCalled()
  expect(recursive).toHaveBeenCalledTimes(1)
  state.child = { count: 3 }
  expect(direct).toHaveBeenCalledTimes(1)
  expect(recursive).toHaveBeenCalledTimes(2)
  stopDirect()
  stopRecursive()
})

import { useLayoutEffect } from 'react'
import { act, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import {
  proxy,
  ref,
  snapshot,
  subscribe,
  unstable_replaceInternalFunction,
} from 'valtio/vanilla'
import type { Snapshot } from 'valtio/vanilla'

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

it('should not confuse a referenced historical snapshot with its previous source', async () => {
  const { useSnapshot } = await import('valtio/react')
  const child = proxy({ count: 1 })
  const oldSnapshot = snapshot(child)
  const state = proxy({ child, unrelated: 0 })
  const renders = vi.fn()
  const Component = () => {
    const tracked = useSnapshot(state)
    renders(tracked.child.count)
    useLayoutEffect(() => {
      state.unrelated++
    })
    return null
  }
  render(<Component />)
  await act(async () => {
    state.child = ref(oldSnapshot)
  })
  expect(renders).toHaveBeenCalledTimes(2)
})

it('should not probe assigned objects with internal symbols', () => {
  const symbolReads: symbol[] = []
  const value = new Proxy(
    { count: 1 },
    {
      get(target, key, receiver) {
        if (typeof key === 'symbol') symbolReads.push(key)
        return Reflect.get(target, key, receiver)
      },
    },
  )
  const state = proxy<{ child?: object }>({})
  state.child = value
  expect(snapshot(state).child).toEqual({ count: 1 })
  expect(symbolReads).toEqual([])
})

it('should clone transparent layers around read proxies before assignment', async () => {
  const { useSnapshot } = await import('valtio/react')
  const { deepClone } = await import('valtio/vanilla/utils')
  const source = proxy({ child: { count: 1, unused: 0 } })
  const destination = proxy<{ value?: object }>({})
  let child!: object
  const renders = vi.fn()
  const Component = () => {
    const tracked = useSnapshot(source)
    child = tracked.child
    renders(tracked.child.count)
    return null
  }
  render(<Component />)
  const get = vi.fn(Reflect.get)
  const cloned = deepClone(new Proxy(child, { get }))
  expect(get).toHaveBeenCalled()
  get.mockClear()
  destination.value = cloned
  snapshot(destination)
  expect(Reflect.set(destination.value, 'count', 2)).toBe(true)
  expect(snapshot(destination).value).toEqual({ count: 2, unused: 0 })
  expect(get).not.toHaveBeenCalled()
  expect(source.child.count).toBe(1)
  expect(renders).toHaveBeenCalledTimes(1)
})

it('should copy nested arrays and preserve refs from read snapshots', async () => {
  const { useSnapshot } = await import('valtio/react')
  const { deepClone } = await import('valtio/vanilla/utils')
  const value = ref({ count: 1 })
  const state = proxy({ child: { items: [{ count: 1 }], value } })
  let copy!: Snapshot<typeof state.child>
  const Component = () => {
    const tracked = useSnapshot(state)
    const cloned = deepClone(tracked.child)
    expect(cloned).not.toBe(tracked.child)
    expect(cloned.items).not.toBe(tracked.child.items)
    expect(cloned.items[0]).not.toBe(tracked.child.items[0])
    expect(cloned.value).toBe(value)
    copy = cloned
    return null
  }
  const { unmount } = render(<Component />)
  unmount()
  const destination = proxy({ child: copy })
  state.child.items[0]!.count = 2
  expect(snapshot(destination).child.items[0]!.count).toBe(1)
  expect(destination.child.value).toBe(value)
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

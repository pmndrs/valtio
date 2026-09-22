import LeakDetectorModule from 'jest-leak-detector'
import { describe, expect, it } from 'vitest'
import { proxy, snapshot, subscribe } from 'valtio'

const LeakDetector = (
  'default' in LeakDetectorModule
    ? LeakDetectorModule.default
    : LeakDetectorModule
) as typeof import('jest-leak-detector').default

describe('no memory leaks with proxy', () => {
  it('should release live state while retaining a historical snapshot', async () => {
    let state = proxy<{ data: { values: number[] } | null }>({ data: null })
    const snap = snapshot(state)
    state.data = { values: Array.from({ length: 1000 }, (_, i) => i) }
    const stateDetector = new LeakDetector(state)
    const subtreeDetector = new LeakDetector(state.data)
    state = undefined as never

    await Promise.resolve()

    expect(await stateDetector.isLeaking()).toBe(false)
    expect(await subtreeDetector.isLeaking()).toBe(false)
    expect(snap.data).toBe(null)
  })

  it('should release nested proxies while retaining their snapshot values', async () => {
    let state = proxy({ child: { count: 1 } })
    const snap = snapshot(state)
    const childDetector = new LeakDetector(state.child)
    state = undefined as never

    await Promise.resolve()

    expect(await childDetector.isLeaking()).toBe(false)
    expect(snap.child.count).toBe(1)
  })

  it('empty object', async () => {
    let state = proxy({})
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let state = proxy({ child: {} })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    const child = {}
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    const child = proxy({})
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let state = proxy({} as { child?: unknown })
    state.child = state
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let state = proxy({ child: {} as { child?: unknown } })
    state.child.child = state
    const detector = new LeakDetector(state)
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })
})

describe('no memory leaks with proxy with subscription', () => {
  it('empty object', async () => {
    let state = proxy({})
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let state = proxy({ child: {} })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    const child = {}
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    const child = proxy({})
    let state = proxy({ child })
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let state = proxy({} as { child?: unknown })
    state.child = state
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let state = proxy({ child: {} as { child?: unknown } })
    state.child.child = state
    const detector = new LeakDetector(state)
    let unsub = subscribe(state, () => {})
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined as never
    state = undefined as never
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })
})

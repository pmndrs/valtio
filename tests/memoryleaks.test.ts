import LeakDetector from 'jest-leak-detector'
import { describe, expect, it } from 'vitest'
import { proxy, subscribe } from 'valtio'

describe('no memory leaks with proxy', () => {
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

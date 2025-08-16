import LeakDetector from 'jest-leak-detector'
import { describe, expect, it } from 'vitest'
import { proxy, subscribe } from 'valtio'

describe('no memory leaks with proxy', () => {
  it('empty object', async () => {
    let detector: LeakDetector
    ;(() => {
      const state = proxy({})
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let detector: LeakDetector
    ;(() => {
      const state = proxy({ child: {} })
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    let detector: LeakDetector
    ;(() => {
      const child = {}
      const state = proxy({ child })
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    let detector: LeakDetector
    ;(() => {
      const child = proxy({})
      const state = proxy({ child })
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let detector: LeakDetector
    ;(() => {
      const state = proxy({} as { child?: unknown })
      state.child = state
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let detector: LeakDetector
    ;(() => {
      const state = proxy({ child: {} as { child?: unknown } })
      state.child.child = state
      detector = new LeakDetector(state)
    })()
    expect(await detector.isLeaking()).toBe(false)
  })
})

describe('no memory leaks with proxy with subscription', () => {
  it('empty object', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const state = proxy({})
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('child object', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const state = proxy({ child: {} })
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child object', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const child = {}
      const state = proxy({ child })
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('global child proxy', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const child = proxy({})
      const state = proxy({ child })
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 1)', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const state = proxy({} as { child?: unknown })
      state.child = state
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })

  it('object cycle (level 2)', async () => {
    let detector: LeakDetector
    let unsub: (() => void) | undefined
    ;(() => {
      const state = proxy({ child: {} as { child?: unknown } })
      state.child.child = state
      detector = new LeakDetector(state)
      unsub = subscribe(state, () => {})
    })()
    await new Promise((resolve) => setTimeout(resolve, 1))
    unsub()
    unsub = undefined
    await Promise.resolve()
    expect(await detector.isLeaking()).toBe(false)
  })
})

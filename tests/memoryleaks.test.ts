import LeakDetector from 'jest-leak-detector'
import { describe, expect, it } from 'vitest'
import { proxy } from 'valtio'

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
})

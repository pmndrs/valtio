import { describe, expect, it } from 'vitest'
import { getVersion, isProxyObject, proxy, ref, snapshot } from 'valtio/vanilla'

describe('direct key revisions', () => {
  it('should keep unrelated keys and unchanged assignments stable', () => {
    const state = proxy({ count: 1, other: 0 })
    const version = getVersion(state, 'count')
    state.other++
    expect(getVersion(state, 'count')).toBe(version)
    state.count = 1
    expect(getVersion(state, 'count')).toBe(version)
    state.count++
    expect(getVersion(state, 'count')).not.toBe(version)
  })

  it('should distinguish direct replacement from descendant changes', () => {
    const state = proxy({ child: { count: 1 } })
    const version = getVersion(state, 'child')
    state.child.count++
    expect(getVersion(state, 'child')).toBe(version)
    state.child = { count: 2 }
    expect(getVersion(state, 'child')).not.toBe(version)
  })

  it('should account for truncated and extended array keys', () => {
    const state = proxy([0, 1, 2])
    const last = getVersion(state, 2)
    const length = getVersion(state, 'length')
    state.length = 1
    expect(getVersion(state, 2)).not.toBe(last)
    expect(getVersion(state, 'length')).not.toBe(length)
    const short = getVersion(state, 'length')
    state[2] = 2
    expect(getVersion(state, 'length')).not.toBe(short)
  })

  it('should revise symbol accessors without evaluating them', () => {
    const key = Symbol()
    let value = 0
    let reads = 0
    const state = proxy({
      get [key]() {
        reads++
        return value
      },
      set [key](next: number) {
        value = next
      },
    })
    const version = getVersion(state, key)
    expect(reads).toBe(0)
    state[key] = 1
    const readsBeforeVersion = reads
    expect(getVersion(state, key)).not.toBe(version)
    expect(reads).toBe(readsBeforeVersion)
  })

  it('should identify proxies without traversing or inspecting values', () => {
    const raw = ref({ count: 1 })
    const state = proxy(raw)
    expect(isProxyObject(raw)).toBe(false)
    expect(isProxyObject(state)).toBe(true)
    expect(isProxyObject(snapshot(state))).toBe(false)
    expect(isProxyObject(null)).toBe(false)
    expect(getVersion({}, 'missing')).toBeUndefined()
  })
})

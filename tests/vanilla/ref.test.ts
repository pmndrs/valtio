import { describe, expect, it, vi } from 'vitest'
import { getVersion, proxy, ref, snapshot, subscribe } from 'valtio'

describe('ref', () => {
  it('should return the same object it was given', () => {
    const obj = { count: 0 }
    expect(ref(obj)).toBe(obj)
  })

  it('should keep the object out of the proxy', () => {
    const inner = ref({ count: 0 })
    const state = proxy({ inner })
    expect(state.inner).toBe(inner)
    expect(getVersion(state.inner)).toBeUndefined()
  })

  it('should keep the same object identity in snapshots', () => {
    const inner = ref({ count: 0 })
    const state = proxy({ inner })
    expect(snapshot(state).inner).toBe(inner)
  })

  it('should not notify when the referenced object mutates', async () => {
    const state = proxy({ inner: ref({ count: 0 }) })
    const handler = vi.fn()
    subscribe(state, handler)

    state.inner.count += 1
    await Promise.resolve()
    expect(handler).toBeCalledTimes(0)
  })

  it('should not change the snapshot when the referenced object mutates', () => {
    const state = proxy({ inner: ref({ count: 0 }) })
    const snap1 = snapshot(state)
    state.inner.count += 1
    expect(snapshot(state)).toBe(snap1)
  })

  it('should notify when the ref itself is replaced', async () => {
    const state = proxy({ inner: ref({ count: 0 }) })
    const handler = vi.fn()
    subscribe(state, handler)

    state.inner = ref({ count: 1 })
    await Promise.resolve()
    expect(handler).toBeCalledTimes(1)
  })

  it('should apply to a proxy object marked as a ref', async () => {
    const inner = proxy({ count: 0 })
    const state = proxy({ inner: ref(inner) })
    const handler = vi.fn()
    subscribe(state, handler)

    inner.count += 1
    await Promise.resolve()
    expect(handler).toBeCalledTimes(0)
  })

  it('should keep arrays marked as refs unproxied', () => {
    const items = ref([{ count: 0 }])
    const state = proxy({ items })
    expect(state.items).toBe(items)
    expect(getVersion(state.items[0])).toBeUndefined()
  })
})

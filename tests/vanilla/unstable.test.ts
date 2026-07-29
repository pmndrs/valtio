import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  proxy,
  snapshot,
  subscribe,
  unstable_enableOp,
  unstable_getInternalStates,
  unstable_replaceInternalFunction,
} from 'valtio'

type InternalFunctionName =
  | 'objectIs'
  | 'newProxy'
  | 'canProxy'
  | 'createSnapshot'
  | 'createHandler'

const restores: (() => void)[] = []

// Replacing an internal function mutates module state for the whole file, so
// every replacement registers its own undo.
const replace = (name: InternalFunctionName, fn: (prev: any) => any) => {
  let original: unknown
  unstable_replaceInternalFunction(name as any, (prev: any) => {
    original = prev
    return fn(prev)
  })
  restores.push(() =>
    unstable_replaceInternalFunction(name as any, () => original as any),
  )
}

afterEach(() => {
  while (restores.length) {
    restores.pop()!()
  }
  unstable_enableOp(false)
})

describe('unstable_getInternalStates', () => {
  it('should expose the internal registries', () => {
    const states = unstable_getInternalStates()
    expect(Object.keys(states).sort()).toEqual([
      'proxyCache',
      'proxyStateMap',
      'refSet',
      'snapCache',
      'versionHolder',
    ])
  })

  it('should track a created proxy in proxyStateMap and proxyCache', () => {
    const { proxyStateMap, proxyCache } = unstable_getInternalStates()
    const base = { count: 0 }
    const state = proxy(base)
    expect(proxyStateMap.has(state)).toBe(true)
    expect(proxyCache.get(base)).toBe(state)
  })

  it('should expose a monotonically increasing versionHolder', () => {
    const { versionHolder } = unstable_getInternalStates()
    const state = proxy({ count: 0 })
    const before = versionHolder[0]
    state.count += 1
    expect(versionHolder[0]).toBeGreaterThan(before)
  })
})

describe('unstable_replaceInternalFunction', () => {
  it('should throw for an unknown function name', () => {
    expect(() =>
      unstable_replaceInternalFunction('nope' as any, (prev: any) => prev),
    ).toThrow('unknown function')
  })

  it('should replace objectIs', () => {
    const objectIs = vi.fn((a: unknown, b: unknown) => Object.is(a, b))
    replace('objectIs', () => objectIs)

    const state = proxy({ count: 0 })
    state.count = 1
    expect(objectIs).toHaveBeenCalled()
  })

  it('should replace newProxy', () => {
    const newProxy = vi.fn(
      <T extends object>(target: T, handler: ProxyHandler<T>) =>
        new Proxy(target, handler),
    )
    replace('newProxy', () => newProxy)

    proxy({ count: 0 })
    expect(newProxy).toHaveBeenCalled()
  })

  it('should replace canProxy to opt a type in', () => {
    replace(
      'canProxy',
      (prev: (x: unknown) => boolean) => (x: unknown) =>
        x instanceof Date ? true : prev(x),
    )

    const state = proxy({ when: new Date(0) })
    const { proxyStateMap } = unstable_getInternalStates()
    expect(proxyStateMap.has(state.when)).toBe(true)
  })

  it('should replace createSnapshot', () => {
    const createSnapshot = vi.fn(
      (prev: any) =>
        <T extends object>(target: T, version: number) =>
          prev(target, version),
    )
    replace('createSnapshot', createSnapshot)

    snapshot(proxy({ count: 0 }))
    expect(createSnapshot).toHaveBeenCalled()
  })

  it('should replace createHandler', () => {
    const createHandler = vi.fn(
      (prev: any) =>
        (...args: any[]) =>
          prev(...args),
    )
    replace('createHandler', createHandler)

    proxy({ count: 0 })
    expect(createHandler).toHaveBeenCalled()
  })
})

describe('unstable_enableOp', () => {
  it('should not report ops by default', async () => {
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    state.count += 1
    await Promise.resolve()
    expect(handler).lastCalledWith([])
  })

  it('should report ops when enabled', async () => {
    unstable_enableOp(true)
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    state.count += 1
    await Promise.resolve()
    expect(handler).lastCalledWith([['set', ['count'], 1, 0]])
  })

  it('should accept a custom op factory', async () => {
    unstable_enableOp(
      (type, prop, ...args) => [type, [prop], ...args, 'extra'] as any,
    )
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    state.count += 1
    await Promise.resolve()
    expect(handler).lastCalledWith([['set', ['count'], 1, 0, 'extra']])
  })

  it('should stop reporting ops when disabled again', async () => {
    unstable_enableOp(true)
    unstable_enableOp(false)
    const state = proxy({ count: 0 })
    const handler = vi.fn()
    subscribe(state, handler)

    state.count += 1
    await Promise.resolve()
    expect(handler).lastCalledWith([])
  })
})

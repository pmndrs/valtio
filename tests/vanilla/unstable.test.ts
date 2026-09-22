import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getVersion,
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

  it('should check each child edge once when updating cyclic versions', () => {
    type State = { cycle: { root: State }; items: { count: number }[] }
    const raw = {} as State
    raw.cycle = { root: raw }
    raw.items = Array.from({ length: 1000 }, () => ({ count: 0 }))
    const state = proxy(raw)
    const states = [state, state.cycle, state.items, ...state.items]
    const { proxyStateMap } = unstable_getInternalStates()
    const checks = states.map((state) =>
      vi.spyOn(proxyStateMap.get(state)!, '1'),
    )
    try {
      snapshot(state)
      checks.forEach((check) => check.mockClear())
      state.items[0]!.count++

      getVersion(state)

      // Guard linear traversal without depending on wall-clock timing.
      expect(
        checks.reduce((total, check) => total + check.mock.calls.length, 0),
      ).toBe(states.length + 1)
    } finally {
      checks.forEach((check) => check.mockRestore())
    }
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

  it('should bound reconciliation work for cyclic aliases', () => {
    interface Node {
      [key: string]: number | Node
    }
    const current: Node[] = Array.from({ length: 5 }, () => ({}))
    Object.assign(current[0]!, {
      id: 0,
      a: current[1],
      b: current[4],
    })
    Object.assign(current[1]!, {
      id: 1,
      b: current[3],
      c: current[0],
    })
    current[3]!.leaf = 1
    Object.assign(current[4]!, { id: 2, b: current[0] })
    const next: Node[] = Array.from({ length: 6 }, () => ({}))
    Object.assign(next[0]!, {
      id: 0,
      a: next[1],
      b: next[3],
      c: next[2],
    })
    Object.assign(next[1]!, {
      id: 4,
      a: next[2],
      b: next[0],
      c: next[2],
    })
    Object.assign(next[2]!, {
      id: 5,
      a: next[1],
      b: next[1],
      c: next[2],
    })
    Object.assign(next[3]!, {
      id: 1,
      a: next[4],
      b: next[0],
      c: next[5],
    })
    Object.assign(next[4]!, {
      id: 3,
      a: next[4],
      b: next[0],
      c: next[1],
    })
    Object.assign(next[5]!, { id: 2, b: next[0] })
    let calls = 0
    replace('objectIs', (prev) => (a: unknown, b: unknown) => {
      ++calls
      return prev(a, b)
    })
    const state = proxy({ node: current[0]! })

    state.node = next[0]!

    expect(calls).toBeLessThan(10_000)
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
    let installed: ReturnType<typeof vi.fn> | undefined
    replace('createSnapshot', (prev: any) => {
      installed = vi.fn((target: object, version: number) =>
        prev(target, version),
      )
      return installed
    })

    const state = proxy({ count: 0 })
    expect(installed).not.toHaveBeenCalled()

    expect(snapshot(state)).toEqual({ count: 0 })
    expect(installed).toHaveBeenCalled()
  })

  it('should replace createHandler', () => {
    let installed: ReturnType<typeof vi.fn> | undefined
    replace('createHandler', (prev: any) => {
      installed = vi.fn((...args: any[]) => prev(...args))
      return installed
    })

    expect(installed).not.toHaveBeenCalled()

    const state = proxy({ count: 0 })
    expect(installed).toHaveBeenCalled()

    state.count += 1
    expect(state.count).toBe(1)
  })

  it('should apply snapshot customization to nested proxies', () => {
    const state = proxy({ child: { count: 1 } })
    const { proxyStateMap } = unstable_getInternalStates()
    const childTarget = proxyStateMap.get(state.child)![0]
    const initialize = vi.fn()
    replace(
      'createSnapshot',
      (prev: any) => (target: object, version: number) => {
        const snap = prev(target, version)
        if (target === childTarget) {
          initialize(snap)
        }
        return snap
      },
    )

    const snap = snapshot(state)

    expect(initialize).toHaveBeenCalledExactlyOnceWith(snap.child)
    state.child.count = 2
    const next = snapshot(state)
    expect(initialize).toHaveBeenLastCalledWith(next.child)
    expect(snap.child.count).toBe(1)
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
      (type, key, ...args) => [type, [key], ...args, 'extra'] as any,
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

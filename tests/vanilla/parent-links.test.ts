import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy, snapshot, subscribe, unstable_getInternalStates } from 'valtio'

setFlagsFromString('--expose-gc')
const gc = runInNewContext('gc') as () => void

// A WeakRef target stays alive until the current job ends.
const collectGarbage = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  gc()
}

// One collection isn't guaranteed to reclaim an object, so this retries
// over a few turns. An object that stays reachable still fails.
const expectCollected = async (ref: WeakRef<object>) => {
  await collectGarbage()
  for (let i = 0; i < 10 && ref.deref(); i++) {
    await collectGarbage()
  }
  expect(ref.deref()).toBeUndefined()
}

describe('versions pushed through parent links', () => {
  it('updates a parent snapshot after a nested write', () => {
    const state = proxy({ a: { b: { count: 0 } }, other: { count: 0 } })
    const snap1 = snapshot(state)
    state.a.b.count = 1
    const snap2 = snapshot(state)
    expect(snap2).not.toBe(snap1)
    expect(snap2.a.b.count).toBe(1)
    expect(snap2.other).toBe(snap1.other)
  })

  it('keeps the cached snapshot after a write to an unrelated proxy', () => {
    const state = proxy({ a: { count: 0 } })
    const unrelated = proxy({ count: 0 })
    const snap = snapshot(state)
    unrelated.count = 1
    expect(snapshot(state)).toBe(snap)
  })

  it('stops hearing a child after it is replaced', () => {
    const state = proxy({ child: { count: 0 } })
    const oldChild = state.child
    state.child = { count: 1 }
    const snap = snapshot(state)
    oldChild.count = 2
    expect(snapshot(state)).toBe(snap)
  })

  it('keeps a child linked under its other key after one key is deleted', () => {
    const child = proxy({ count: 0 })
    const state = proxy<{ a?: typeof child; b: typeof child }>({
      a: child,
      b: child,
    })
    snapshot(state)
    delete state.a
    child.count = 1
    expect(snapshot(state).b.count).toBe(1)
  })

  it('keeps a child linked to its other parent after it leaves one', () => {
    const child = proxy({ count: 0 })
    const parent1 = proxy({ child })
    const parent2 = proxy({ child })
    const snap1 = snapshot(parent1)
    snapshot(parent2)
    parent1.child = proxy({ count: 0 })
    const snap1AfterReplace = snapshot(parent1)
    child.count = 1
    expect(snapshot(parent2).child.count).toBe(1)
    expect(snapshot(parent1)).toBe(snap1AfterReplace)
    expect(snap1AfterReplace).not.toBe(snap1)
  })

  it('links a child assigned into a linked parent', () => {
    const state = proxy<{ child?: { count: number } }>({})
    snapshot(state)
    state.child = { count: 0 }
    snapshot(state)
    state.child.count = 1
    expect(snapshot(state).child?.count).toBe(1)
  })

  it('pushes a write around a cycle', () => {
    type C = { next?: A }
    type B = { c: C; leaf: { count: number } }
    type A = { next: B }
    const leaf = proxy({ count: 0 })
    const c = proxy<C>({})
    const b = proxy<B>({ c, leaf })
    const a = proxy<A>({ next: b })
    c.next = a
    snapshot(c)
    leaf.count = 1
    // A version walk from a reaches c through b before it reaches the
    // leaf, so it used to leave c's version stale.
    expect(snapshot(a).next.leaf.count).toBe(1)
    expect(snapshot(c).next?.next.leaf.count).toBe(1)
  })

  it('pushes a write up a deep chain without growing the call stack', () => {
    const leaf = proxy({ count: 0 })
    let root: object = leaf
    for (let i = 0; i < 20000; i++) {
      root = proxy({ child: root })
      // links one level at a time; unsubscribing keeps the link
      subscribe(root, () => {})()
    }
    const callback = vi.fn()
    subscribe(root, callback)
    leaf.count = 1
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('still notifies an ancestor when a callback detaches the subtree', () => {
    const state = proxy<{ mid: { leaf: { count: number } } | null }>({
      mid: { leaf: { count: 0 } },
    })
    const mid = state.mid!
    const rootCallback = vi.fn()
    subscribe(state, rootCallback)
    subscribe(mid, () => {
      state.mid = null
    })
    mid.leaf.count = 1
    // once for the leaf write, once for the detachment
    expect(rootCallback).toHaveBeenCalledTimes(2)
    expect(snapshot(state).mid).toBe(null)
  })

  it('queues own subscribers before ancestors', () => {
    const state = proxy({ child: { count: 0 } })
    const calls: string[] = []
    subscribe(state, () => calls.push('parent'))
    subscribe(state.child, () => calls.push('child'))
    state.child.count = 1
    expect(calls).toEqual(['child', 'parent'])
  })

  it('queues nearer ancestors first', () => {
    const leaf = proxy({ count: 0 })
    const state = proxy({ left: { leaf }, right: { leaf } })
    const calls: string[] = []
    subscribe(state, () => calls.push('state'))
    subscribe(state.left, () => calls.push('left'))
    subscribe(state.right, () => calls.push('right'))
    subscribe(leaf, () => calls.push('leaf'))
    leaf.count = 1
    expect(calls).toEqual(['leaf', 'left', 'right', 'state'])
  })

  it('notifies an ancestor once, at its nearest distance', () => {
    const leaf = proxy({ count: 0 })
    const left = proxy({ leaf })
    const right = proxy({ leaf })
    // root also holds leaf directly, so it is as near as left and right
    const root = proxy({ leaf, left, right })
    const calls: string[] = []
    subscribe(root, () => calls.push('root'))
    subscribe(left, () => calls.push('left'))
    subscribe(right, () => calls.push('right'))
    subscribe(leaf, () => calls.push('leaf'))
    leaf.count = 1
    expect(calls[0]).toBe('leaf')
    expect(calls.slice(1).sort()).toEqual(['left', 'right', 'root'])
  })

  it('keeps pushing versions after the last unsubscribe', () => {
    const state = proxy({ child: { count: 0 } })
    const unsubscribe = subscribe(state, () => {})
    unsubscribe()
    const snap = snapshot(state)
    state.child.count = 1
    expect(snapshot(state)).not.toBe(snap)
    expect(snapshot(state).child.count).toBe(1)
  })
})

describe('garbage collection', () => {
  it('collects a snapshotted parent around a child that is still used', async () => {
    const child = proxy({ count: 0 })
    let parentRef: WeakRef<object> | undefined
    ;(() => {
      const parent = proxy({ child })
      snapshot(parent)
      parentRef = new WeakRef(parent)
    })()
    await expectCollected(parentRef!)
    child.count = 1
    expect(snapshot(child).count).toBe(1)
  })

  it('drops dead parent links from a child that is never written', async () => {
    const child = proxy({ count: 0 })
    const parentLinks =
      unstable_getInternalStates().proxyStateMap.get(child)![3]
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 1000; i++) {
        snapshot(proxy({ child }))
      }
      await collectGarbage()
    }
    // without a sweep, all 5,000 would stay until the child is written
    expect(parentLinks.size).toBeLessThan(3000)
  }, 30_000) // each collection takes a while

  it('keeps a subscribed parent alive with no reference left to it', async () => {
    const state = proxy({ a: { count: 0 } })
    const callback = vi.fn()
    let parentRef: WeakRef<object> | undefined
    ;(() => {
      // neither the parent nor the unsubscribe function is kept
      const parent = proxy({ a: state.a })
      subscribe(parent, callback)
      parentRef = new WeakRef(parent)
    })()
    for (let i = 0; i < 3; i++) {
      await collectGarbage()
    }
    expect(parentRef!.deref()).toBeDefined()
    state.a.count = 1
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('lets a subscribed parent be collected after it is unsubscribed', async () => {
    const state = proxy({ a: { count: 0 } })
    const callback = vi.fn()
    let parentRef: WeakRef<object> | undefined
    let unsubscribe: (() => void) | undefined
    ;(() => {
      const parent = proxy({ a: state.a })
      unsubscribe = subscribe(parent, callback)
      parentRef = new WeakRef(parent)
    })()
    await collectGarbage()
    state.a.count = 1
    expect(callback).toHaveBeenCalledTimes(1)
    unsubscribe!()
    // the unsubscribe function itself still refers to the parent
    unsubscribe = undefined
    await expectCollected(parentRef!)
    state.a.count = 2
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('WeakRef requirement', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws from proxy() without WeakRef', () => {
    vi.stubGlobal('WeakRef', undefined)
    expect(() => proxy({})).toThrow(
      'Valtio requires WeakRef. On React Native, use the New Architecture.',
    )
  })
})

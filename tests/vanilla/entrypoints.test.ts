import { describe, expect, it, vi } from 'vitest'
import * as main from 'valtio'
import * as react from 'valtio/react'
import * as reactUtils from 'valtio/react/utils'
import * as mainUtils from 'valtio/utils'
import * as vanilla from 'valtio/vanilla'
import * as vanillaUtils from 'valtio/vanilla/utils'

// docs/how-tos/some-gotchas.mdx tells non-React users to import from
// valtio/vanilla and valtio/vanilla/utils, and the photo-booth example does.
// Nothing else in the suite touches those entry points.
//
// These tests also run against the built CJS and ESM output, where the CJS
// interop adds a `default` key that the sources do not have, so it is dropped
// before comparing.
const exportsOf = (ns: object) =>
  Object.keys(ns)
    .filter((key) => key !== 'default')
    .sort()

describe('entry points', () => {
  it('should expose the core from valtio/vanilla', () => {
    expect(exportsOf(vanilla)).toEqual([
      'getVersion',
      'proxy',
      'ref',
      'snapshot',
      'subscribe',
      'unstable_enableOp',
      'unstable_getInternalStates',
      'unstable_replaceInternalFunction',
    ])
  })

  it('should not expose React bindings from valtio/vanilla', () => {
    expect(exportsOf(vanilla)).not.toContain('useSnapshot')
    expect(exportsOf(vanillaUtils)).not.toContain('useProxy')
  })

  it('should expose the utils from valtio/vanilla/utils', () => {
    expect(exportsOf(vanillaUtils)).toEqual([
      'deepClone',
      'devtools',
      'isProxyMap',
      'isProxySet',
      'proxyMap',
      'proxySet',
      'subscribeKey',
      'unstable_deepProxy',
    ])
  })

  it('should expose useSnapshot from valtio/react and useProxy from valtio/react/utils', () => {
    expect(exportsOf(react)).toEqual(['useSnapshot'])
    expect(exportsOf(reactUtils)).toEqual(['useProxy'])
  })

  it('should re-export both halves from the main entry points', () => {
    expect(exportsOf(main)).toEqual(
      [...exportsOf(vanilla), ...exportsOf(react)].sort(),
    )
    expect(exportsOf(mainUtils)).toEqual(
      [...exportsOf(vanillaUtils), ...exportsOf(reactUtils)].sort(),
    )
  })

  it('should work end to end through valtio/vanilla alone', async () => {
    const state = vanilla.proxy({ count: 0, nested: { text: 'a' } })
    const handler = vi.fn()
    vanilla.subscribe(state, handler)

    state.count += 1
    state.nested.text = 'b'
    await Promise.resolve()

    expect(handler).toBeCalledTimes(1)
    expect(vanilla.snapshot(state)).toEqual({ count: 1, nested: { text: 'b' } })
  })

  it('should work end to end through valtio/vanilla/utils alone', () => {
    const set = vanillaUtils.proxySet([1, 2])
    const map = vanillaUtils.proxyMap<string, number>([['a', 1]])

    expect(vanillaUtils.isProxySet(set)).toBe(true)
    expect(vanillaUtils.isProxyMap(map)).toBe(true)
    expect(vanillaUtils.deepClone({ nested: { count: 0 } })).toEqual({
      nested: { count: 0 },
    })
  })
})

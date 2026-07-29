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
describe('entry points', () => {
  it('should expose the core from valtio/vanilla', () => {
    expect(Object.keys(vanilla).sort()).toEqual([
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
    expect('useSnapshot' in vanilla).toBe(false)
    expect('useProxy' in vanillaUtils).toBe(false)
  })

  it('should expose the utils from valtio/vanilla/utils', () => {
    expect(Object.keys(vanillaUtils).sort()).toEqual([
      'deepClone',
      'devtools',
      'isProxyMap',
      'isProxySet',
      'proxyMap',
      'proxySet',
      'subscribeKey',
      'unstable_deepProxy',
      'watch',
    ])
  })

  it('should expose useSnapshot from valtio/react and useProxy from valtio/react/utils', () => {
    expect(Object.keys(react)).toEqual(['useSnapshot'])
    expect(Object.keys(reactUtils)).toEqual(['useProxy'])
  })

  it('should re-export both halves from the main entry points', () => {
    for (const key of Object.keys(vanilla)) {
      expect(main).toHaveProperty(key)
    }
    expect(main).toHaveProperty('useSnapshot')

    for (const key of Object.keys(vanillaUtils)) {
      expect(mainUtils).toHaveProperty(key)
    }
    expect(mainUtils).toHaveProperty('useProxy')
  })

  it('should share the same proxy registry across entry points', () => {
    const state = vanilla.proxy({ count: 0 })
    expect(main.getVersion(state)).toBeDefined()
    expect(main.snapshot(state)).toEqual({ count: 0 })
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
})

/* eslint-disable @typescript-eslint/ban-ts-comment */
import plugin from 'babel-plugin-macros'
import BabelPluginTester from 'babel-plugin-tester'
import { describe, expect, it } from 'vitest'

// @ts-ignore
globalThis.describe = describe
// @ts-ignore
globalThis.it = it
// @ts-ignore
globalThis.expect = expect

const pluginTester = (BabelPluginTester as any).default || BabelPluginTester

pluginTester({
  pluginName: 'valtio/macro',
  plugin,
  snapshot: true,
  babelOptions: {
    filename: './valtio/tests',
    parserOpts: { plugins: ['jsx'] },
  },
  tests: [
    `
import { useProxy } from '../dist/macro'

const Component = () => {
  useProxy(state)
  return (
    <div>
      {state.count}
      <button onClick={() => ++state.count}>inc</button>
    </div>
  )
}
`,
    `
import { useProxy } from '../dist/macro'

const Component = () => {
  useProxy(state)
  return (
    <div>
      <button onClick={() => {
        ;(() => ++state.count)()
        ++state.count
      }}>inc</button>
      {state.count}
    </div>
  )
}
`,
  ],
})

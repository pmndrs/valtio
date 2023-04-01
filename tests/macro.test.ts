import plugin from 'babel-plugin-macros'
import BabelPluginTester from 'babel-plugin-tester'

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

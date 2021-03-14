import pluginTester from 'babel-plugin-tester'
import plugin from 'babel-plugin-macros'

pluginTester({
  pluginName: 'valtio/macro',
  plugin,
  snapshot: true,
  babelOptions: {
    filename: __filename,
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
  ],
})

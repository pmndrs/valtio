import { EnvContext } from '@typed-macro/core'
import { createTransformer } from '@typed-macro/runtime'
import { expect, it } from 'vitest'
import { valtioMacro } from 'valtio/macro/vite'

const env: EnvContext = {
  host: 'test',
  packageManager: 'test',
  projectPath: [''],
  dev: true,
  ssr: false,
}

it('basic', async () => {
  const transform = createTransformer({})
  transform.appendMacros('valtio/macro', [valtioMacro])

  expect(
    transform.transform(
      `
import { useProxy } from 'valtio/macro'

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
      'test.ts',
      env
    )
  ).toMatchSnapshot()
})

it('complex', async () => {
  const transform = createTransformer({})
  transform.appendMacros('valtio/macro', [valtioMacro])

  expect(
    transform.transform(
      `
import { useProxy } from 'valtio/macro'

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
      'test.ts',
      env
    )
  ).toMatchSnapshot()
})

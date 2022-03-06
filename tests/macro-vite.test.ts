import { createTransformer } from '@typed-macro/runtime'
import { createTestTransformer, Macro } from 'vite-plugin-macro'
import { valtioMacro } from 'valtio/macro/vite'
import { EnvContext } from '@typed-macro/core'

declare type NamespacedMacros = {
  [namespace: string]: Macro[]
}
//
// export function createTestTransformer({
//   maxTraversals,
//   parserPlugins,
//   macros,
// }: TestTransformerOptions): TestTransformer {
//   const transformer = createTransformer({ maxTraversals, parserPlugins })
//   Object.keys(macros).forEach((moduleName) =>
//     transformer.appendMacros(moduleName, macros[moduleName])
//   )
//   return (input) => {
//     // normalized
//     const {
//       code,
//       filepath = 'test.ts',
//       env = createTestEnvContext(),
//     } = isString(input) ? { code: input } : input
//
//     // prepare transformer
//     return transformer.transform(code, filepath, env) || code
//   }
// }

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

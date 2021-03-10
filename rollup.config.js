import path from 'path'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { sizeSnapshot } from 'rollup-plugin-size-snapshot'

const createBabelConfig = require('./babel.config')

const { root } = path.parse(process.cwd())
const external = (id) =>
  id.startsWith('./vanilla') || (!id.startsWith('.') && !id.startsWith(root))
const extensions = ['.js', '.ts', '.tsx']
const getBabelOptions = (targets) => ({
  ...createBabelConfig({ env: (env) => env === 'build' }, targets),
  extensions,
})

function createDeclarationConfig(input, output) {
  return {
    input,
    output: {
      dir: output,
    },
    external,
    plugins: [typescript({ declaration: true, outDir: output })],
  }
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'esm' },
    external,
    plugins: [
      resolve({ extensions }),
      typescript(),
      babel(getBabelOptions({ node: 8 })),
      sizeSnapshot(),
    ],
  }
}

function createCommonJSConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'cjs', exports: 'named' },
    external,
    plugins: [
      resolve({ extensions }),
      typescript(),
      babel(getBabelOptions({ ie: 11 })),
      sizeSnapshot(),
    ],
  }
}

export default [
  createDeclarationConfig('src/index.ts', 'dist'),
  createCommonJSConfig('src/index.ts', 'dist/index.js'),
  createCommonJSConfig('src/vanilla.ts', 'dist/vanilla.js'),
  createCommonJSConfig('src/utils.ts', 'dist/utils.js'),
  createCommonJSConfig('src/macro.ts', 'dist/macro.js'),
  createESMConfig('src/index.ts', 'dist/index.module.js'),
  createESMConfig('src/vanilla.ts', 'dist/vanilla.module.js'),
  createESMConfig('src/utils.ts', 'dist/utils.module.js'),
  createESMConfig('src/macro.ts', 'dist/macro.module.js'),
]

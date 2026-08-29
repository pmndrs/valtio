/*global process*/
import path from 'path'
import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import esbuild from 'rollup-plugin-esbuild'

const extensions = ['.js', '.ts', '.tsx']
const { root } = path.parse(process.cwd())
export const entries = [
  { find: /.*\/vanilla\/utils\.ts$/, replacement: 'valtio/vanilla/utils' },
  { find: /.*\/react\/utils\.ts$/, replacement: 'valtio/react/utils' },
  { find: /.*\/vanilla\.ts$/, replacement: 'valtio/vanilla' },
  { find: /.*\/react\.ts$/, replacement: 'valtio/react' },
]

function external(id) {
  return !id.startsWith('.') && !id.startsWith(root)
}

function getEsbuild() {
  return esbuild({
    target: 'es2018',
    supported: { 'import-meta': true },
    tsconfig: path.resolve('./tsconfig.json'),
  })
}

function createDeclarationConfig(input, output) {
  return {
    input,
    output: {
      dir: output,
    },
    external,
    plugins: [
      typescript({
        declaration: true,
        emitDeclarationOnly: true,
        outDir: output,
      }),
    ],
  }
}

function createESMConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'esm' },
    external,
    plugins: [
      alias({ entries: entries.filter((entry) => !entry.find.test(input)) }),
      resolve({ extensions }),
      getEsbuild(),
    ],
  }
}

export default function (args) {
  let c = Object.keys(args).find((key) => key.startsWith('config-'))
  if (c) {
    c = c.slice('config-'.length).replace(/_/g, '/')
  } else {
    c = 'index'
  }
  return [
    ...(c === 'index' ? [createDeclarationConfig(`src/${c}.ts`, 'dist')] : []),
    createESMConfig(`src/${c}.ts`, `dist/${c}.js`),
  ]
}

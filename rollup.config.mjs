/*global process*/
import path from 'path'
import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
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
      replace({
        ...(output.endsWith('.js')
          ? {
              'import.meta.env?.MODE': 'process.env.NODE_ENV',
            }
          : {
              'import.meta.env?.MODE':
                '(import.meta.env ? import.meta.env.MODE : undefined)',
            }),
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild(),
    ],
  }
}

function createCommonJSConfig(input, output) {
  return {
    input,
    output: { file: output, format: 'cjs' },
    external,
    plugins: [
      alias({ entries: entries.filter((entry) => !entry.find.test(input)) }),
      resolve({ extensions }),
      replace({
        'import.meta.env?.MODE': 'process.env.NODE_ENV',
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild(),
    ],
  }
}

function createUMDConfig(input, output, globalName) {
  return {
    input,
    output: {
      file: output,
      format: 'umd',
      name: globalName,
      globals: {
        'react': 'React'
      }
    },
    external: (id) => {
      // Always externalize React for UMD builds that use it
      if (id === 'react') {
        return true
      }
      // Bundle everything else including proxy-compare for UMD
      return false
    },
    plugins: [
      resolve({ extensions, browser: true, preferBuiltins: false }),
      replace({
        'import.meta.env?.MODE': 'typeof process !== "undefined" && process.env ? process.env.NODE_ENV : "development"',
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild(),
    ],
  }
}

// Helper function to get the global name for UMD builds
function getGlobalName(configName) {
  const globalNames = {
    'index': 'Valtio',
    'vanilla': 'ValtioVanilla',
    'react': 'ValtioReact',
    'utils': 'ValtioUtils',
    'vanilla/utils': 'ValtioVanillaUtils',
    'react/utils': 'ValtioReactUtils'
  }
  return globalNames[configName] || 'Valtio'
}

export default function (args) {
  let c = Object.keys(args).find((key) => key.startsWith('config-'))
  if (c) {
    c = c.slice('config-'.length).replace(/_/g, '/')
  } else {
    c = 'index'
  }

  const configs = [
    ...(c === 'index' ? [createDeclarationConfig(`src/${c}.ts`, 'dist')] : []),
    createCommonJSConfig(`src/${c}.ts`, `dist/${c}.js`),
    createESMConfig(`src/${c}.ts`, `dist/esm/${c}.mjs`),
  ]

  // Add UMD build for main entry points and utils
  if (['index', 'vanilla', 'react', 'utils', 'vanilla/utils', 'react/utils'].includes(c)) {
    configs.push(createUMDConfig(`src/${c}.ts`, `dist/umd/${c.replace('/', '_')}.js`, getGlobalName(c)))
  }

  return configs
}

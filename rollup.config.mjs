import { dirname, parse, resolve } from 'node:path'
import alias from '@rollup/plugin-alias'
import babelPlugin from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
// import typescript from '@rollup/plugin-typescript'
import { default as esbuild } from 'rollup-plugin-esbuild'
import createBabelConfig from './babel.config.js'
import dts from 'rollup-plugin-dts'

const extensions = ['.js', '.ts', '.tsx']
const { root } = parse(process.cwd())
const entries = [
  // { find: /.*\/vanilla\/utils\.ts$/, replacement: 'valtio/vanilla/utils' },
  // { find: /.*\/react\/utils\.ts$/, replacement: 'valtio/react/utils' },
  // { find: /.*\/vanilla\.ts$/, replacement: 'valtio/vanilla' },
  // { find: /.*\/react\.ts$/, replacement: 'valtio/react' },
]

function external(id) {
  return !id.startsWith('.') && !id.startsWith(root)
}

function getBabelOptions(targets) {
  return {
    ...createBabelConfig({ env: (env) => env === 'build' }, targets),
    extensions,
    comments: false,
    babelHelpers: 'bundled',
  }
}

function getEsbuild(env = 'development') {
  return esbuild({
    minify: env === 'production',
    target: 'es2018',
    supported: { 'import-meta': true },
    tsconfig: resolve('./tsconfig.json'),
  })
}

/**
 * @param input {string}
 * @return {import('rollup').RollupOptions[]}
 */
function createDeclarationConfig(input) {
  const file = `dist/${input}`
  /** @type {import('rollup').RollupOptions[]}*/
  const entry = [{
    // modern build
    input: `src/${input}.ts`,
    output: [
      { file: `${file}.d.cts` },
      { file: `${file}.d.mts` },
      { file: `${file}.d.ts` }, // for node10 compatibility
    ],
    external,
    plugins: [
      dts(),
    ],
  }, {
    // ts 3.4 build
    input: `src/${input}.ts`,
    output: [
      { file: `dist/ts3.4/${file}.d.ts` }, // only for node10 compatibility
    ],
    external,
    plugins: [
      dts({
        compilerOptions: {
          target: "es5",
        }
      }),
    ],
  }]
  return entry
}

/**
 * @param input {string}
 * @return {import('rollup').RollupOptions}
 */
function createESMConfig(input) {
  /** @type {import('rollup').RollupOptions}*/
  const entry= {
    input: `src/${input}.ts`,
    output: {
      file: `dist/${input}.mjs`,
      format: "esm",
      exports: "auto",
    },
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      nodeResolve({ extensions }),
      replace({
        ...({
          'import.meta.env?.MODE': 'process.env.NODE_ENV',
        }),
        // a workround for #410
        'use-sync-external-store/shim': 'use-sync-external-store/shim/index.js',
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild(),
    ],
  }
  return entry
}

/**
 * @param input {string}
 * @return {import('rollup').RollupOptions}
 */
function createCommonJSConfig(input) {
  /** @type {import('rollup').RollupOptions}*/
  const entry = {
    input: `src/${input}.ts`,
    output: {
      file: `dist/${input}.cjs`,
      format: "cjs",
      exports: "auto"
    },
    interop: "auto",
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      nodeResolve({ extensions }),
      replace({
        'import.meta.env?.MODE': 'process.env.NODE_ENV',
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
    ],
  }
  return entry
}

function createUMDConfig(input, output, env) {
  let name = 'valtio'
  const fileName = output.slice('dist/umd/'.length)
  const capitalize = (s) => s.slice(0, 1).toUpperCase() + s.slice(1)
  if (fileName !== 'index') {
    name += fileName.replace(/(\w+)\W*/g, (_, p) => capitalize(p))
  }
  /** @type {import('rollup').RollupOptions}*/
  const entry = {
    input,
    output: {
      file: `${output}.${env}.js`,
      format: 'umd',
      name,
      globals: {
        react: 'React',
        'valtio/vanilla': 'valtioVanilla',
        'valtio/utils': 'valtioUtils',
        'valtio/react': 'valtioReact',
        'valtio/vanilla/utils': 'valtioVanillaUtils',
        'valtio/react/utils': 'valtioReactUtils',
      },
    },
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      nodeResolve({ extensions }),
      replace({
        'import.meta.env?.MODE': JSON.stringify(env),
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      babelPlugin(getBabelOptions({ ie: 11 })),
      ...(env === 'production' ? [terser()] : []),
    ],
  }

  return entry
}

function createSystemConfig(input, output, env) {
  /** @type {import('rollup').RollupOptions}*/
  const entry = {
    input,
    output: {
      file: `${output}.${env}.js`,
      format: 'system',
    },
    external,
    plugins: [
      alias({ entries: entries.filter((e) => !e.find.test(input)) }),
      nodeResolve({ extensions }),
      replace({
        'import.meta.env?.MODE': JSON.stringify(env),
        delimiters: ['\\b', '\\b(?!(\\.|/))'],
        preventAssignment: true,
      }),
      getEsbuild(env),
    ],
  }

  return entry
}

export default function (args) {
  let c = Object.keys(args).find((key) => key.startsWith('config-'))
  if (c) {
    c = c.slice('config-'.length).replace(/_/g, '/')
  } else {
    c = 'index'
  }
  const generate = [
    'index',
    'macro',
    'macro/vite',
    'react',
    'react/utils',
    'utils',
    'vanilla',
    'vanilla/utils',
  ]
  if (c === "all") {
    return generate.reverse().reduce((acc, c) => {
      acc.push(
        ...createDeclarationConfig(c),
        createCommonJSConfig(c),
        createESMConfig(c),
        createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'development'),
        createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'production'),
        createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'development'),
        createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'production'),
      )
      return acc
    }, /** @type {import('rollup').RollupOptions[]}*/ [])
  } else {
    return [
      ...createDeclarationConfig(c),
      createCommonJSConfig(c),
      createESMConfig(c),
      createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'development'),
      createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'production'),
      createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'development'),
      createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'production'),
    ]
  }
  // return [
  //   ...(c === 'index' ? createDeclarationConfig(c) : []),
  //   createCommonJSConfig(c),
  //   // createESMConfig(`src/${c}.ts`, `dist/esm/${c}.js`),
  //   // createESMConfig(`src/${c}.ts`, `dist/esm/${c}.mjs`),
  //   createESMConfig(c),
  //   /*createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'development'),
  //   createUMDConfig(`src/${c}.ts`, `dist/umd/${c}`, 'production'),
  //   createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'development'),
  //   createSystemConfig(`src/${c}.ts`, `dist/system/${c}`, 'production'),*/
  // ]
}

export { entries }

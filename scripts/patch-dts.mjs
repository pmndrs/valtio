import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

patchDts()

/**
 * @param path {string}
 * @return {Promise<void>}
 */
async function fixMacro(path) {
  const code = await readFile(path, 'utf8')
  await writeFile(
    path,
    code.replace('export { macro as default }', 'export = macro'),
    'utf8',
  )
  // await writeFile(path, code.replace('export { macro as default, useProxy }', 'export = macro;\nexport { useProxy }'), 'utf8')
  console.log(`${path} CJS patched`)
}

/**
 * @param path {string}
 * @return {Promise<void>}
 */
async function fixMacroVite(path) {
  const code = await readFile(path, 'utf8')
  await writeFile(
    path,
    code.replace(
      'export { macroPlugin as default, provideValtioMacro, valtioMacro }',
      'export = macroPlugin;\nexport { provideValtioMacro, valtioMacro }',
    ),
    'utf8',
  )
  console.log(`${path} CJS patched`)
}

async function patchDts() {
  const rootDir = dirname(resolve(fileURLToPath(import.meta.url), '..'))
  const macro = ['macro.d']
    .map((name) => [
      `${rootDir}/dist/${name}.ts`,
      `${rootDir}/dist/${name}.cts`,
      `${rootDir}/dist/ts3.4/${name}.ts`,
    ])
    .flat()
  const macroVite = ['macro/vite.d']
    .map((name) => [
      `${rootDir}/dist/${name}.ts`,
      `${rootDir}/dist/${name}.cts`,
      `${rootDir}/dist/ts3.4/${name}.ts`,
    ])
    .flat()

  await Promise.all([...macro.map(fixMacro), ...macroVite.map(fixMacroVite)])
}

import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

fixCjs()

/**
 * @param path {string}
 * @return {Promise<void>}
 */
async function fixMacro(path) {
  const code = await readFile(path, 'utf8')
  await writeFile(path, code.replace('export { macro as default }', 'export = macro'), 'utf8')
  // await writeFile(path, code.replace('export { macro as default, useProxy }', 'export = macro;\nexport { useProxy }'), 'utf8')
  console.log(`${path} CJS patched`)
}

async function fixCjs() {
  const rootDir = dirname(resolve(fileURLToPath(import.meta.url), '..'))
  const files =
    ['macro.d']
      .map((name) => [`${rootDir}/dist/${name}.ts`, `${rootDir}/dist/${name}.cts`])
      .flat()

  await Promise.all(files.map(fixMacro))
}

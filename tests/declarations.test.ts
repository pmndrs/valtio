import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

// Type-checks the public declarations the way an app with the ES2020 lib
// and skipLibCheck off would, without writing them to disk.
it('keeps the declarations usable with the ES2020 lib', () => {
  const srcDir = resolve('src')
  // a folder that doesn't exist, so imports can't reach the sources
  const dtsDir = resolve('declarations')
  const declarations = new Map<string, string>()
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        collect(path)
      } else if (path.endsWith('.ts')) {
        const { outputText } = ts.transpileDeclaration(
          readFileSync(path, 'utf8'),
          { fileName: path },
        )
        declarations.set(
          path.replace(srcDir, dtsDir).replace(/\.ts$/, '.d.ts'),
          outputText,
        )
      }
    }
  }
  collect(srcDir)
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const { fileExists, readFile, getSourceFile, directoryExists } = host
  host.directoryExists = (dir) =>
    dir.startsWith(dtsDir) || (directoryExists?.(dir) ?? false)
  host.fileExists = (fileName) =>
    declarations.has(fileName) || fileExists(fileName)
  host.readFile = (fileName) => declarations.get(fileName) ?? readFile(fileName)
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const text = declarations.get(fileName)
    return text === undefined
      ? getSourceFile(fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, text, languageVersion)
  }
  const program = ts.createProgram([...declarations.keys()], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  expect(ts.formatDiagnostics(diagnostics, host)).toBe('')
}, 30_000) // building a TypeScript program takes a few seconds

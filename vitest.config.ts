import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'valtio',
    setupFiles: './tests/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html', 'text-summary'],
      reportsDirectory: './coverage/',
    },
    environment: 'jsdom',
    dir: 'tests',
    alias: [
      {
        find: /^valtio$/,
        replacement: './src/index.ts'
      },
      {
        find: /^valtio\/(.*)$/,
        replacement: path.resolve(__dirname, './src/$1.ts')
      },
    ],
  },
})

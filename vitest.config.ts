import { resolve } from 'path'
// eslint-disable-next-line import/extensions
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^valtio$/, replacement: resolve('./src/index.ts') },
      { find: /^valtio(.*)$/, replacement: resolve('./src/$1.ts') },
    ],
  },
  test: {
    name: 'valtio',
    // Keeping globals to true triggers React Testing Library's auto cleanup
    // https://vitest.dev/guide/migration.html
    globals: true,
    coverage: {
      include: ['src/**/'],
      reporter: ['text', 'json', 'html', 'text-summary'],
      reportsDirectory: './coverage/',
    },
    environment: 'jsdom',
    dir: 'tests',
  },
})

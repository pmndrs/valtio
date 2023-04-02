import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: './tests/setup.ts',
    coverage: { include: ['src/**/*.{js,ts,tsx}', 'tests/**/*.{js,ts,tsx}'] },
    environment: 'jsdom',
    include: ['./tests/**/*.test.{js,ts,tsx}'],
    alias: [
      {
        find: new RegExp('^valtio$'),
        replacement: './src/index.ts',
      },
      {
        find: new RegExp('^valtio/(.*)$'),
        replacement: './src/$1.ts',
      },
    ],
  },
})

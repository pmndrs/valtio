import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    coverage: { include: ['src/**/*.{js,ts,tsx}', 'tests/**/*.{js,ts,tsx}'] },
    environment: 'jsdom',
    include: ['./tests/**/*.{js,ts,tsx}'],
    globals: true,
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

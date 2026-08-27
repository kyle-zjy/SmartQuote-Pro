import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pagesBase = process.env.GITHUB_PAGES === 'true' ? '/SmartQuote-Pro/' : '/'

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

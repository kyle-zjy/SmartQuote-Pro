import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pagesBase =
  process.env.PAGES_BASE || (process.env.GITHUB_PAGES === 'true' ? '/SmartQuote-Pro/' : '/')

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  server: {
    // This repo lives on a WSL2 DrvFS-mounted drive, where the OS never emits inotify events for
    // edits made from the Linux side -- Vite's default watcher silently misses file changes and
    // keeps serving stale modules. Polling makes the dev server actually pick up edits.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pagesBase =
  process.env.PAGES_BASE || (process.env.GITHUB_PAGES === 'true' ? '/SmartQuote-Pro/' : '/')

export default defineConfig({
  base: pagesBase,
  cacheDir: process.env.VITE_CACHE_DIR,
  plugins: [react()],
  // Restrict cold dependency scans to this application's entry point. Old dependency
  // folders on the mounted drive can otherwise be scanned as unrelated HTML entries.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true } },
    // This repo lives on a WSL2 DrvFS-mounted drive, where the OS never emits inotify events for
    // edits made from the Linux side -- Vite's default watcher silently misses file changes and
    // keeps serving stale modules. Polling makes the dev server actually pick up edits.
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/.node_modules-stale-*/**', '**/.pnpm-store/**', '**/playwright-report/**', '**/test-results/**'],
    },
  },
})

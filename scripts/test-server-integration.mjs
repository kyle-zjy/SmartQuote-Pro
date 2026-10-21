import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { readdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const serverDir = fileURLToPath(new URL('../server/', import.meta.url))
const require = createRequire(new URL('../package.json', import.meta.url))
const serverRequire = createRequire(new URL('../server/package.json', import.meta.url))
const database = `smartquote_integration_${Date.now()}_${process.pid}`
const container = process.env.TEST_POSTGRES_CONTAINER || 'smartquote-pro-postgres-1'
const ownedDatabase = !process.env.TEST_DATABASE_URL
const url =
  process.env.TEST_DATABASE_URL ||
  `postgresql://smartquote:smartquote@localhost:5432/${database}?schema=public`
if (!/\/smartquote_integration_[^/?]+(?:\?|$)/.test(url))
  throw new Error('TEST_DATABASE_URL must identify a dedicated smartquote_integration_* database.')
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url,
  INITIAL_ADMIN_EMAIL: 'admin@goldco.com.au',
  INITIAL_ADMIN_PASSWORD: 'admin',
  INITIAL_STAFF_EMAIL: 'staff@goldco.com.au',
  INITIAL_STAFF_PASSWORD: 'staff',
}
const children = []
const cacheDir = path.join(os.tmpdir(), `smartquote-vite-${database}`)
function run(command, args, cwd = serverDir, extra = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...env, ...extra }, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Command failed: ${command} ${args[0] || ''}`)
}
async function freePort() {
  const socket = createServer()
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  return port
}
function start(args, cwd, extra) {
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...extra }, stdio: 'inherit' })
  children.push(child)
  return child
}
async function waitFor(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Integration service stopped during startup.')
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* Service is starting. */
    }
    await delay(200)
  }
  throw new Error('Integration service did not become ready.')
}
let created = false
try {
  if (ownedDatabase) {
    run('docker', ['exec', container, 'createdb', '-U', 'smartquote', database], root)
    created = true
  }
  run(process.execPath, [serverRequire.resolve('prisma/build/index.js'), 'migrate', 'deploy'])
  run(process.execPath, [serverRequire.resolve('prisma/build/index.js'), 'generate'])
  run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'])
  run(process.execPath, ['--import', 'tsx', 'scripts/bootstrap.ts'])
  run(process.execPath, [serverRequire.resolve('typescript/bin/tsc'), '-b'])
  const tests = (await readdir(new URL('../server/test/', import.meta.url)))
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => `test/${name}`)
  run(process.execPath, ['--test', ...tests], serverDir, { RUN_DATABASE_TESTS: '1' })
  const apiPort = await freePort(),
    uiPort = await freePort()
  const backend = start(['dist/src/index.js'], serverDir, { PORT: String(apiPort) })
  await waitFor(`http://127.0.0.1:${apiPort}/health/ready`, backend)
  const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  const buildDir = path.join(cacheDir, 'dist')
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '-b'], root)
  run(process.execPath, [viteCli, 'build', '--outDir', buildDir, '--emptyOutDir'], root, {
    NODE_ENV: 'production', VITE_DATA_MODE: 'server', VITE_API_URL: '/api/v1',
  })
  const frontend = start(
    [
      viteCli,
      'preview',
      '--outDir',
      buildDir,
      '--host',
      '127.0.0.1',
      '--port',
      String(uiPort),
      '--strictPort',
    ],
    root,
    {
      NODE_ENV: 'production',
      VITE_CACHE_DIR: cacheDir,
      API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      VITE_API_URL: '/api/v1',
      VITE_DATA_MODE: 'server',
    },
  )
  await waitFor(`http://127.0.0.1:${uiPort}`, frontend)
  run(
    process.execPath,
    [
      require.resolve('@playwright/test/cli'),
      'test',
      'e2e/server-collaboration.spec.ts',
      '--workers=1',
      '--reporter=list',
    ],
    root,
    { PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${uiPort}`, PLAYWRIGHT_SERVER_MODE: '1' },
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(5000).then(() => {
          if (child.exitCode === null) child.kill('SIGKILL')
        }),
      ])
    }
  }
  if (created) {
    const cleanup = spawnSync(
      'docker',
      ['exec', container, 'dropdb', '--force', '-U', 'smartquote', database],
      { stdio: 'inherit' },
    )
    if (cleanup.status !== 0) {
      console.error('Could not remove the temporary integration database.')
      process.exitCode = 1
    }
  }
  await rm(cacheDir, { recursive: true, force: true })
}

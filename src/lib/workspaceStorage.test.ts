import { afterEach, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../test/memoryStorage'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
it('keeps strict persistence failures in local-only mode', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_DATA_MODE', 'local')
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  const { workspaceStorage } = await import('./workspaceStorage')
  storage.failWrites = true
  expect(() => workspaceStorage.setItem('test', 'value')).toThrow('Full')
})
it('enumerates pending drafts and retries removals without resurrecting deleted entries', async () => {
  vi.resetModules()
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('VITE_DATA_MODE', 'server')
  vi.stubGlobal('window', new EventTarget())
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  const { workspaceStorage, retryBrowserCache } = await import('./workspaceStorage')
  storage.failWrites = true
  workspaceStorage.setItem('smartquote-pro:draft:a:v1', 'draft')
  expect(workspaceStorage.length).toBe(1)
  expect(workspaceStorage.key(0)).toBe('smartquote-pro:draft:a:v1')
  workspaceStorage.removeItem('smartquote-pro:draft:a:v1')
  expect(workspaceStorage.length).toBe(0)
  storage.failWrites = false
  expect(retryBrowserCache()).toBe(true)
  expect(storage.getItem('smartquote-pro:draft:a:v1')).toBeNull()
})
it('can read the current working copy if persistent storage becomes unreadable', async () => {
  vi.resetModules()
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('VITE_DATA_MODE', 'server')
  vi.stubGlobal('window', new EventTarget())
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  const { workspaceStorage, browserCacheUnavailable } = await import('./workspaceStorage')
  workspaceStorage.setItem('smartquote-pro:draft:a:v1', 'current draft')
  vi.spyOn(storage, 'getItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError')
  })
  expect(workspaceStorage.getItem('smartquote-pro:draft:a:v1')).toBe('current draft')
  expect(browserCacheUnavailable()).toBe(true)
})

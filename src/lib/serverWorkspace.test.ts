import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../test/memoryStorage'
import type { ServerRecord } from './serverWorkspace'

const ARCHIVE = 'smartquote-pro:archive',
  DRAFT = 'smartquote-pro:draft:33021:v1'
const quote = (name = 'Original') => ({
  quoteNo: '33021',
  version: 1,
  customer: { name },
  items: [{ unitPrice: 650 }],
  roomPhotos: {},
})
const archived = (name = 'Original') => ({
  quoteNo: '33021',
  version: 1,
  quote: quote(name),
  comments: [],
})
let remote: Map<string, ServerRecord>, offline: boolean
let workspace: typeof import('./serverWorkspace')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('VITE_DATA_MODE', 'server')
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  vi.stubGlobal('window', new EventTarget())
  localStorage.setItem('smartquote-pro:server-initialized', '1')
  sessionStorage.setItem('smartquote-pro:api-token', 'test-session')
  remote = new Map([
    ['quote:33021:v1', { id: 'quote:33021:v1', revision: 1, deleted: false, value: archived() }],
    ['draft:33021:v1', { id: 'draft:33021:v1', revision: 1, deleted: false, value: quote() }],
  ])
  offline = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit = {}) => {
      if (offline) throw new Error('Connection interrupted')
      if (options.method === 'PATCH') {
        const { changes } = JSON.parse(options.body as string) as {
          changes: Array<{ id: string; expected: number; value: Record<string, unknown> }>
        }
        if (changes.some((c) => (remote.get(c.id)?.revision ?? 0) !== c.expected))
          return new Response(
            JSON.stringify({ error: { code: 'CONFLICT', message: 'Changed elsewhere' } }),
            { status: 409 },
          )
        const records = changes.map((c) => ({
          id: c.id,
          value: clone(c.value ?? {}),
          deleted: c.value === null,
          revision: (remote.get(c.id)?.revision ?? 0) + 1,
        }))
        for (const r of records) remote.set(r.id, r)
        return new Response(JSON.stringify({ cursor: 1, records }))
      }
      return new Response(
        JSON.stringify({ cursor: 1, records: clone([...remote.values()]), staff: [] }),
      )
    }),
  )
  workspace = await import('./serverWorkspace')
  await workspace.initializeWorkspace()
  workspace.pinQuote('33021')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
function editArchive(name: string) {
  localStorage.setItem(ARCHIVE, JSON.stringify([archived(name)]))
}

describe('database workspace cache and conflict handling', () => {
  it('reports committed saves as successful when cache persistence fails, and can save again', async () => {
    const cache = await import('./workspaceStorage')
    const storage = localStorage as MemoryStorage
    const request = fetch
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      const response = await request(url, options)
      if (options.method === 'PATCH') storage.failWrites = true
      return response
    })
    await workspace.remoteStorageTransaction(() =>
      cache.workspaceStorage.setItem(ARCHIVE, JSON.stringify([archived('First committed save')])),
    )
    expect(remote.get('quote:33021:v1')!.value.quote).toEqual(quote('First committed save'))
    expect(workspace.getSyncError()).toBe('')
    expect(cache.browserCacheUnavailable()).toBe(true)
    expect(JSON.parse(cache.workspaceStorage.getItem(ARCHIVE)!)[0].quote.customer.name).toBe(
      'First committed save',
    )
    await workspace.remoteStorageTransaction(() =>
      cache.workspaceStorage.setItem(ARCHIVE, JSON.stringify([archived('Second committed save')])),
    )
    expect(remote.get('quote:33021:v1')!.revision).toBe(3)
    storage.failWrites = false
    expect(cache.retryBrowserCache()).toBe(true)
    expect(cache.browserCacheUnavailable()).toBe(false)
    expect(JSON.parse(localStorage.getItem(ARCHIVE)!)[0].quote.customer.name).toBe(
      'Second committed save',
    )
  })
  it('initializes an existing shared workspace with full cache and preserves unsent drafts in memory', async () => {
    const cache = await import('./workspaceStorage')
    ;(localStorage as MemoryStorage).failWrites = true
    await expect(workspace.initializeWorkspace()).resolves.toBeUndefined()
    const edited = quote('Offline with full cache')
    cache.workspaceStorage.setItem(DRAFT, JSON.stringify(edited))
    offline = true
    await expect(workspace.saveRemoteDraft(edited)).rejects.toThrow('Cannot reach the server')
    expect(JSON.parse(cache.workspaceStorage.getItem(DRAFT)!)).toEqual(edited)
    offline = false
    await workspace.saveRemoteDraft(edited)
    expect(remote.get('draft:33021:v1')!.value).toEqual(edited)
    expect(cache.browserCacheUnavailable()).toBe(true)
  })
  it('uses a hydrated shared draft instead of a stale last-opened compatibility copy', async () => {
    localStorage.setItem('smartquote-pro:quote', JSON.stringify(quote('Old compatibility copy')))
    sessionStorage.setItem('smartquote-pro:active-quote', JSON.stringify(['33021', 1]))
    remote.set('draft:33021:v1', {
      id: 'draft:33021:v1',
      revision: 2,
      deleted: false,
      value: quote('Confirmed server save'),
    })
    await workspace.initializeWorkspace()
    const { readTabDraft } = await import('./quotePersist')
    expect(JSON.parse(readTabDraft()!).customer.name).toBe('Confirmed server save')
  })
  it('retains server errors and restores the in-memory archive if cache and network both fail', async () => {
    const { workspaceStorage } = await import('./workspaceStorage')
    ;(localStorage as MemoryStorage).failWrites = true
    offline = true
    await expect(
      workspace.remoteStorageTransaction(() =>
        workspaceStorage.setItem(ARCHIVE, JSON.stringify([archived('Not committed')])),
      ),
    ).rejects.toThrow('Cannot reach the server')
    expect(workspace.getSyncError()).toContain('Cannot reach the server')
    expect(JSON.parse(workspaceStorage.getItem(ARCHIVE)!)[0].quote.customer.name).toBe('Original')
    expect(remote.get('quote:33021:v1')!.revision).toBe(1)
  })
  it('does not overwrite legacy data when its migration backup cannot be persisted', async () => {
    localStorage.removeItem('smartquote-pro:server-initialized')
    ;(localStorage as MemoryStorage).failWrites = true
    await expect(workspace.initializeWorkspace()).rejects.toThrow(
      'Cannot preserve previous browser data',
    )
    expect(JSON.parse(localStorage.getItem(ARCHIVE)!)[0].quote.customer.name).toBe('Original')
  })
  it('keeps an editing baseline when polling discovers another browser changed the quote', async () => {
    remote.set('quote:33021:v1', {
      id: 'quote:33021:v1',
      revision: 2,
      deleted: false,
      value: archived('Other browser'),
    })
    await workspace.refreshWorkspace(true)
    localStorage.setItem(DRAFT, JSON.stringify(quote('My unsent edits')))
    await expect(
      workspace.remoteStorageTransaction(() => editArchive('My stale overwrite')),
    ).rejects.toThrow('Changed elsewhere')
    expect(JSON.parse(localStorage.getItem(ARCHIVE)!)[0].quote.customer.name).toBe('Other browser')
    expect(JSON.parse(localStorage.getItem(DRAFT)!).customer.name).toBe('My unsent edits')
    expect(remote.get('quote:33021:v1')!.value.quote).toEqual(quote('Other browser'))
  })
  it('rebases office notes without treating unchanged commercial content as a conflicting edit', async () => {
    remote.set('quote:33021:v1', {
      id: 'quote:33021:v1',
      revision: 2,
      deleted: false,
      value: { ...archived(), comments: [{ text: 'Office returned the quote' }] },
    })
    await workspace.refreshWorkspace(true)
    await workspace.remoteStorageTransaction(() => editArchive('Corrected quote'))
    expect(remote.get('quote:33021:v1')!.revision).toBe(3)
    expect(remote.get('quote:33021:v1')!.value.quote).toEqual(quote('Corrected quote'))
  })
  it('preserves unsent working copies and their baseline across workspace initialization', async () => {
    const edited = quote('Unsent local work')
    localStorage.setItem(DRAFT, JSON.stringify(edited))
    offline = true
    await expect(workspace.saveRemoteDraft(edited)).rejects.toThrow('Cannot reach the server')
    offline = false
    await workspace.initializeWorkspace()
    workspace.pinQuote('33021')
    expect(JSON.parse(localStorage.getItem(DRAFT)!)).toEqual(edited)
    await workspace.saveRemoteDraft(edited)
    expect(remote.get('draft:33021:v1')!.value).toEqual(edited)
    expect(localStorage.getItem('smartquote-pro:unsynced-drafts')).toBeNull()
  })
})

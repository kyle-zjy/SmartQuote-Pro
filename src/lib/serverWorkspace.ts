import { workspaceStorage } from './workspaceStorage'
import { api, readToken, SERVER_DATA_EVENT, SERVER_MODE, SYNC_STATUS_EVENT } from './apiClient'
import type { QuoteState } from './quoteContext'

export interface ServerRecord {
  id: string
  value: Record<string, unknown>
  revision: number
  deleted: boolean
  updatedAt?: string
}
type Documents = Map<string, Record<string, unknown>>
interface Snapshot {
  cursor: number
  records?: ServerRecord[]
  staff?: Array<Record<string, unknown>>
  unchanged?: boolean
}
const ARCHIVE = 'smartquote-pro:archive',
  REVIEWS = 'smartquote-pro:reviews',
  OWNERS = 'smartquote-pro:quote-owners',
  COMPANY = 'smartquote-pro:company',
  PRICING = 'smartquote-pro:pricing',
  DRAFT = 'smartquote-pro:draft:',
  LEGACY = 'smartquote-pro:pre-server-v1'
const DIRTY = 'smartquote-pro:unsynced-drafts'
export const LEGACY_BACKUP_KEY = LEGACY
const records = new Map<string, ServerRecord>()
const stagedPhotos = new Map<string, Record<string, unknown> | null>()
const pinned = new Map<string, number>()
let pinnedQuote: string | null = null
let cursor: number | undefined
let queue: Promise<unknown> = Promise.resolve()
let syncError = ''
let hydrated = false
export const recordKey = (kind: string, quoteNo: string, version: number) =>
  `${kind}:${encodeURIComponent(quoteNo)}:v${version}`
function expectedRevision(id: string) {
  const editing =
    pinnedQuote !== null &&
    ['quote', 'draft', 'photo', 'wizard'].some((kind) =>
      id.startsWith(`${kind}:${encodeURIComponent(pinnedQuote!)}:`),
    )
  return pinned.get(id) ?? (editing ? 0 : (records.get(id)?.revision ?? 0))
}
const parse = (key: string, fallback: unknown) =>
  JSON.parse(workspaceStorage.getItem(key) ?? JSON.stringify(fallback))
interface DirtyDraft {
  expected: number
  quoteExpected: number
}
const dirtyDrafts = () => parse(DIRTY, {}) as Record<string, DirtyDraft>
function setDirty(id: string, value: DirtyDraft | null) {
  const drafts = dirtyDrafts()
  if (value) drafts[id] = value
  else delete drafts[id]
  if (Object.keys(drafts).length) workspaceStorage.setItem(DIRTY, JSON.stringify(drafts))
  else workspaceStorage.removeItem(DIRTY)
}
const stable = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  )
function notify() {
  window.dispatchEvent(new Event(SERVER_DATA_EVENT))
}
export function reportSyncError(error: unknown) {
  syncError = error instanceof Error ? error.message : String(error)
  window.dispatchEvent(new Event(SYNC_STATUS_EVENT))
}
export function getSyncError() {
  return syncError
}
function clearError() {
  if (syncError) {
    syncError = ''
    window.dispatchEvent(new Event(SYNC_STATUS_EVENT))
  }
}
export function localDocuments(): Documents {
  const docs: Documents = new Map()
  for (const record of parse(ARCHIVE, []) as Array<Record<string, unknown>>)
    docs.set(recordKey('quote', record.quoteNo as string, record.version as number), record)
  for (const review of parse(REVIEWS, []) as Array<Record<string, unknown>>)
    docs.set(recordKey('review', review.quoteNo as string, review.version as number), review)
  for (const [no, staffId] of Object.entries(parse(OWNERS, {}) as Record<string, string>))
    docs.set(`owner:${encodeURIComponent(no)}`, { staffId })
  for (const [key, id] of [
    [COMPANY, 'company'],
    [PRICING, 'pricing'],
  ])
    if (workspaceStorage.getItem(key)) docs.set(id, parse(key, {}))
  for (let i = 0; i < workspaceStorage.length; i++) {
    const key = workspaceStorage.key(i)!
    if (key.startsWith(DRAFT)) docs.set(`draft:${key.slice(DRAFT.length)}`, parse(key, {}))
  }
  for (const [key, value] of Object.entries(
    parse('smartquote-pro:wizard-drafts', {}) as Record<string, Record<string, unknown>>,
  )) {
    const no = key.split('::')[0]
    docs.set(`wizard:${encodeURIComponent(no)}:${encodeURIComponent(key)}`, {
      ...value,
      quoteNo: no,
      storageKey: key,
    })
  }
  for (const record of records.values())
    if (record.id.startsWith('photo:') && !record.deleted) docs.set(record.id, record.value)
  for (const [id, value] of stagedPhotos) {
    if (value) docs.set(id, value)
    else docs.delete(id)
  }
  return docs
}
function materialize(updateDrafts: boolean) {
  const active = [...records.values()].filter((r) => !r.deleted)
  workspaceStorage.setItem(
    ARCHIVE,
    JSON.stringify(active.filter((r) => r.id.startsWith('quote:')).map((r) => r.value)),
  )
  workspaceStorage.setItem(
    REVIEWS,
    JSON.stringify(active.filter((r) => r.id.startsWith('review:')).map((r) => r.value)),
  )
  workspaceStorage.setItem(
    OWNERS,
    JSON.stringify(
      Object.fromEntries(
        active
          .filter((r) => r.id.startsWith('owner:'))
          .map((r) => [decodeURIComponent(r.id.slice(6)), r.value.staffId]),
      ),
    ),
  )
  for (const [id, key] of [
    ['company', COMPANY],
    ['pricing', PRICING],
  ]) {
    const r = records.get(id)
    if (r && !r.deleted) workspaceStorage.setItem(key, JSON.stringify(r.value))
  }
  if (updateDrafts)
    for (const r of records.values()) {
      if (
        r.id.startsWith('draft:') &&
        !dirtyDrafts()[r.id] &&
        !r.id.startsWith(`draft:${encodeURIComponent(pinnedQuote ?? '')}:v`)
      ) {
        const key = `${DRAFT}${r.id.slice(6)}`
        if (r.deleted) workspaceStorage.removeItem(key)
        else workspaceStorage.setItem(key, JSON.stringify(r.value))
      }
    }
  if (updateDrafts) {
    const wizards = parse('smartquote-pro:wizard-drafts', {}) as Record<string, unknown>
    for (const r of records.values())
      if (
        r.id.startsWith('wizard:') &&
        !r.id.startsWith(`wizard:${encodeURIComponent(pinnedQuote ?? '')}:`)
      ) {
        const key = String(
          r.value.storageKey ?? decodeURIComponent(r.id.slice(r.id.lastIndexOf(':') + 1)),
        )
        if (r.deleted) delete wizards[key]
        else wizards[key] = r.value
      }
    workspaceStorage.setItem('smartquote-pro:wizard-drafts', JSON.stringify(wizards))
  }
}
export function pinQuote(no: string) {
  if (!SERVER_MODE || pinnedQuote === no) return
  pinnedQuote = no
  pinned.clear()
  for (const r of records.values())
    if (
      ['quote', 'draft', 'photo', 'wizard'].some((kind) =>
        r.id.startsWith(`${kind}:${encodeURIComponent(no)}:`),
      )
    )
      pinned.set(r.id, r.revision)
  for (const [id, value] of Object.entries(dirtyDrafts()))
    if (id.startsWith(`draft:${encodeURIComponent(no)}:v`)) {
      pinned.set(id, value.expected)
      pinned.set(`quote:${id.slice(6)}`, value.quoteExpected)
    }
}
export function reloadPinnedQuote(no: string) {
  for (const id of Object.keys(dirtyDrafts()))
    if (id.startsWith(`draft:${encodeURIComponent(no)}:v`)) setDirty(id, null)
  pinnedQuote = null
  pinQuote(no)
  for (const r of records.values())
    if (r.id.startsWith(`draft:${encodeURIComponent(no)}:v`) && !r.deleted)
      workspaceStorage.setItem(`${DRAFT}${r.id.slice(6)}`, JSON.stringify(r.value))
  for (const r of records.values())
    if (r.id.startsWith(`quote:${encodeURIComponent(no)}:v`) && !r.deleted) {
      const key = `${DRAFT}${r.id.slice(6)}`
      const draft = records.get(`draft:${r.id.slice(6)}`)
      const quote = r.value.quote as Record<string, unknown>
      if (!draft || (quote.status === 'issued' && draft.value.status !== 'issued'))
        workspaceStorage.setItem(key, JSON.stringify(quote))
    }
  clearError()
}
export async function refreshWorkspace(force = false) {
  if (!SERVER_MODE || !readToken()) return
  const snapshot = await api<Snapshot>(
    `/workspace${cursor !== undefined && !force ? `?cursor=${cursor}` : ''}`,
  )
  if (snapshot.unchanged) return
  if (!snapshot.records) throw new Error('The server workspace is incomplete.')
  // Office notes change the archive revision without changing the submitted quote.
  // Rebase those metadata-only updates while retaining conflicts on actual quote edits.
  for (const next of snapshot.records) {
    const previous = records.get(next.id)
    if (
      previous &&
      pinned.get(next.id) === previous.revision &&
      !next.deleted &&
      !previous.deleted &&
      stable(next.id.startsWith('quote:') ? next.value.quote : next.value) ===
        stable(next.id.startsWith('quote:') ? previous.value.quote : previous.value)
    )
      pinned.set(next.id, next.revision)
  }
  records.clear()
  for (const r of snapshot.records) records.set(r.id, r)
  if (snapshot.staff)
    workspaceStorage.setItem(
      'smartquote-pro:staff',
      JSON.stringify(snapshot.staff.map((member) => ({ ...member, password: '' }))),
    )
  materialize(true)
  cursor = snapshot.cursor
  hydrated = true
  notify()
}
export async function initializeWorkspace() {
  cursor = undefined
  records.clear()
  pinned.clear()
  pinnedQuote = null
  hydrated = false
  stagedPhotos.clear()
  if (!workspaceStorage.getItem('smartquote-pro:server-initialized')) {
    const docs = localDocuments()
    const legacyDraft = workspaceStorage.getItem('smartquote-pro:quote')
    if (legacyDraft) {
      const q = JSON.parse(legacyDraft)
      if (q.quoteNo && (q.items?.length || q.customer?.name))
        docs.set(recordKey('draft', q.quoteNo, q.version || 1), q)
    }
    if (docs.size && !workspaceStorage.getItem(LEGACY)) {
      // This is a migration backup, not a disposable server cache. Never replace
      // legacy data until its backup is durably persisted in this browser.
      try {
        localStorage.setItem(
          LEGACY,
          JSON.stringify({ documents: [...docs], staff: parse('smartquote-pro:staff', []) }),
        )
      } catch {
        throw new Error(
          'Cannot preserve previous browser data because browser storage is full or unavailable. Export a backup or free browser storage before connecting this browser to the server.',
        )
      }
    }
    // Old local data is preserved above before the shared workspace becomes the active cache.
    const keys = Array.from(
      { length: workspaceStorage.length },
      (_, i) => workspaceStorage.key(i)!,
    ).filter((k) => k.startsWith(DRAFT))
    for (const key of keys) workspaceStorage.removeItem(key)
    workspaceStorage.removeItem('smartquote-pro:quote')
    sessionStorage.removeItem('smartquote-pro:active-quote')
  }
  await refreshWorkspace(true)
  workspaceStorage.setItem('smartquote-pro:server-initialized', '1')
}
async function patchDocuments(
  changes: Array<{ id: string; expected: number; value: unknown }>,
  importing = false,
) {
  if (!changes.length) return
  const result = await api<Snapshot>('/workspace', {
    method: 'PATCH',
    body: JSON.stringify({ changes, importing }),
  })
  for (const r of result.records ?? []) {
    records.set(r.id, r)
    if (
      pinned.has(r.id) ||
      ['quote', 'draft', 'photo', 'wizard'].some((kind) =>
        r.id.startsWith(`${kind}:${encodeURIComponent(pinnedQuote ?? '')}:`),
      )
    )
      pinned.set(r.id, r.revision)
  }
  // Keep the cursor unchanged: a following poll must also fetch any unrelated writes committed by other clients.
  materialize(false)
  notify()
  clearError()
}
export function serializeServer<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work)
  queue = next.catch(() => {})
  return next
}
export async function remoteStorageTransaction<T>(
  write: () => T | Promise<T>,
  importing = false,
): Promise<T> {
  if (!SERVER_MODE) return write()
  if (!hydrated || !readToken())
    throw new Error('Sign in and connect to the shared workspace before saving.')
  return serializeServer(async () => {
    const before = localDocuments()
    let result: T
    try {
      result = await write()
      const after = localDocuments()
      const changes = [...new Set([...before.keys(), ...after.keys()])]
        .filter((id) => JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)))
        .map((id) => ({ id, expected: expectedRevision(id), value: after.get(id) ?? null }))
      await patchDocuments(changes, importing)
      stagedPhotos.clear()
      return result
    } catch (error) {
      // Preserve scoped working copies; archive/review/settings are restored to server truth.
      materialize(false)
      stagedPhotos.clear()
      reportSyncError(error)
      notify()
      throw error
    }
  })
}
export async function saveRemoteDraft(quote: Record<string, unknown>) {
  if (
    !SERVER_MODE ||
    !hydrated ||
    !readToken() ||
    (!(quote.items as unknown[])?.length && !(quote.customer as { name?: string })?.name)
  )
    return
  const id = recordKey('draft', quote.quoteNo as string, quote.version as number)
  const existing = dirtyDrafts()[id]
  setDirty(
    id,
    existing ?? {
      expected: expectedRevision(id),
      quoteExpected: expectedRevision(`quote:${id.slice(6)}`),
    },
  )
  await serializeServer(async () => {
    if (stable(records.get(id)?.value) !== stable(quote))
      await patchDocuments([{ id, expected: expectedRevision(id), value: quote }])
    const current = workspaceStorage.getItem(`${DRAFT}${id.slice(6)}`)
    if (current && stable(JSON.parse(current)) === stable(quote)) setDirty(id, null)
    else
      setDirty(id, {
        expected: records.get(id)?.revision ?? 0,
        quoteExpected: expectedRevision(`quote:${id.slice(6)}`),
      })
  })
}
export async function allocateQuoteNumber(requested?: string) {
  return (
    await api<{ quoteNo: string }>('/workspace/number', {
      method: 'POST',
      body: JSON.stringify({ requested }),
    })
  ).quoteNo
}
export function remotePhotos(no: string, version: number) {
  return records.get(recordKey('photo', no, version))?.value ?? null
}
export async function saveRemotePhotos(no: string, version: number, photos: unknown) {
  if (!hydrated || !readToken()) throw new Error('Connect to the workspace before saving photos.')
  const id = recordKey('photo', no, version)
  if (
    !records.has(id) &&
    photos &&
    Object.values(photos).every((list) => Array.isArray(list) && !list.length)
  )
    return
  await serializeServer(async () => {
    if (JSON.stringify(records.get(id)?.value) !== JSON.stringify(photos))
      await patchDocuments([{ id, expected: expectedRevision(id), value: photos }])
  })
}
export function stageRemotePhotoEntries(entries: Record<string, unknown>) {
  for (const [key, value] of Object.entries(entries)) {
    const match = key.match(/^(.*):v(\d+)$/)
    if (match)
      stagedPhotos.set(
        recordKey('photo', match[1], Number(match[2])),
        value as Record<string, unknown> | null,
      )
  }
}
export function serverPhotoEntries() {
  return Object.fromEntries(
    [...records.values()]
      .filter((r) => r.id.startsWith('photo:') && !r.deleted)
      .map((r) => [
        decodeURIComponent(r.id.slice(6, r.id.lastIndexOf(':v'))) +
          r.id.slice(r.id.lastIndexOf(':v')),
        r.value,
      ]),
  )
}
export function legacyImportCount() {
  const raw = workspaceStorage.getItem(LEGACY)
  if (!raw) return 0
  return (JSON.parse(raw).documents as Array<[string, unknown]>).filter(
    ([id]) => id.startsWith('quote:') || id.startsWith('draft:'),
  ).length
}
export async function importLegacyWorkspace(
  photoEntries: Record<string, unknown>,
  normalizeQuote: (value: Partial<QuoteState>, fallbackNo?: string) => QuoteState,
) {
  const raw = workspaceStorage.getItem(LEGACY)
  if (!raw) return 0
  const legacy = JSON.parse(raw) as {
    documents: Array<[string, Record<string, unknown>]>
    staff: Array<Record<string, unknown>>
  }
  let count = 0
  // Import related quote/review/photo records in one transaction; never overwrite server records.
  await serializeServer(async () => {
    await refreshWorkspace(true)
    const docs = new Map(
      legacy.documents.filter(
        ([id]) =>
          /^(quote:|draft:|review:|owner:|wizard:)/.test(id) &&
          (!records.has(id) || records.get(id)?.deleted),
      ),
    )
    for (const [id, value] of docs) {
      if (id.startsWith('quote:')) {
        const q = normalizeQuote(
          value.quote as Parameters<typeof normalizeQuote>[0],
          value.quoteNo as string,
        )
        docs.set(id, { ...value, quote: q })
        if (
          q.status === 'office-review' &&
          !docs.has(recordKey('review', q.quoteNo, q.version)) &&
          !records.has(recordKey('review', q.quoteNo, q.version))
        )
          docs.set(recordKey('review', q.quoteNo, q.version), {
            quoteNo: q.quoteNo,
            version: q.version,
            status: 'pending',
          })
      } else if (id.startsWith('draft:'))
        docs.set(id, normalizeQuote(value) as unknown as Record<string, unknown>)
      else if (id.startsWith('wizard:')) docs.set(id, { ...value, updatedAt: Date.now() })
    }
    for (const [id, value] of docs)
      if (id.startsWith('quote:') || id.startsWith('draft:')) {
        const q = (id.startsWith('quote:') ? value.quote : value) as {
          quoteNo: string
          version: number
        }
        const photos =
          photoEntries[`${q.quoteNo}:v${q.version}`] ??
          (q.version === 1 ? photoEntries[q.quoteNo] : undefined)
        const photoId = recordKey('photo', q.quoteNo, q.version)
        if (photos && !records.has(photoId)) docs.set(photoId, photos as Record<string, unknown>)
      }
    const changes = [...docs].map(([id, value]) => ({
      id,
      expected: records.get(id)?.revision ?? 0,
      value,
    }))
    await patchDocuments(changes, true)
    count = changes.filter((c) => c.id.startsWith('quote:') || c.id.startsWith('draft:')).length
  })
  if (legacy.staff?.length) {
    await api('/staff/import', {
      method: 'POST',
      body: JSON.stringify({
        members: legacy.staff.filter(
          (member) => typeof member.password === 'string' && member.password.length >= 4,
        ),
      }),
    })
    legacy.staff = []
    workspaceStorage.setItem(LEGACY, JSON.stringify(legacy))
    await serializeServer(() => refreshWorkspace(true))
  }
  return count
}

export async function saveRemoteWizard(
  no: string,
  key: string,
  value: Record<string, unknown> | null,
) {
  if (!SERVER_MODE || !hydrated || !readToken()) return
  const id = `wizard:${encodeURIComponent(no)}:${encodeURIComponent(key)}`
  await serializeServer(async () => {
    const next = value ? { ...value, quoteNo: no, storageKey: key } : null
    if (stable(records.get(id)?.value ?? null) !== stable(next))
      await patchDocuments([{ id, expected: expectedRevision(id), value: next }])
  })
}

export function legacySettingsAvailable() {
  const raw = workspaceStorage.getItem(LEGACY)
  return Boolean(
    raw &&
      (JSON.parse(raw).documents as Array<[string, unknown]>).some(
        ([id]) => id === 'company' || id === 'pricing',
      ),
  )
}
export async function importLegacySettings() {
  const raw = workspaceStorage.getItem(LEGACY)
  if (!raw) return
  await serializeServer(async () => {
    await refreshWorkspace(true)
    const docs = (JSON.parse(raw).documents as Array<[string, unknown]>).filter(
      ([id]) => id === 'company' || id === 'pricing',
    )
    await patchDocuments(
      docs.map(([id, value]) => ({ id, expected: records.get(id)?.revision ?? 0, value })),
    )
  })
}
export function sharedRecordRevision(id: string) {
  return records.get(id)?.revision ?? 0
}
export async function saveSharedSetting(
  id: 'company' | 'pricing',
  value: unknown,
  expected: number,
) {
  await serializeServer(() => patchDocuments([{ id, expected, value }]))
}

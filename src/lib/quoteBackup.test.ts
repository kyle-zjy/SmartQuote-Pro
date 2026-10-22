import { describe, expect, it } from 'vitest'
import { normalizeQuote } from './quoteContext'
import { ARCHIVE_KEY, upsertArchivedQuote } from './quoteArchive'
import { createQuoteBackup, parseQuoteBackup, planQuoteRestore, restoreQuoteBackup } from './quoteBackup'
import { DRAFT_STORAGE_KEY, persistDraftQuote, quoteDraftKey, readTabDraft } from './quotePersist'
import { MemoryStorage } from '../test/memoryStorage'
import { OWNER_KEY, REVIEW_KEY } from './reviewStore'
import type { RoomPhoto } from './quoteContext'
import { emptyItemDraft } from '../pages/quote-item/itemDraft'
import { WIZARD_STORAGE_KEY, loadWizardDraft } from '../pages/quote-item/wizardDraftStore'

const image = 'data:image/png;base64,dGVzdA=='
const quote = () => normalizeQuote({ quoteNo: 'BACKUP-1', quoteNumber: 'BACKUP-1', customer: { name: 'Ada', address: '1 Test St', phone: '0400000000' },
  items: [{ id: 'item-1', description: 'Door', detail: '', quantity: 1, unitPrice: 100, room: 'Living', note: '', photos: [{ id: 'item-photo', dataUrl: image, strokes: [], annotatedDataUrl: null }] }],
  roomPhotos: { Living: [{ id: 'room-photo', caption: 'Site', dataUrl: image }] },
})
function photoStore(initial: Record<string, Record<string, RoomPhoto[]>> = {}) {
  const entries = structuredClone(initial)
  return {
    read: async () => structuredClone(entries),
    write: async (updates: Record<string, Record<string, RoomPhoto[]> | null>) => {
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) delete entries[key]
        else entries[key] = structuredClone(value)
      }
    },
  }
}
async function backup() {
  const storage = new MemoryStorage()
  const state = quote()
  upsertArchivedQuote(state, { total: 110 }, storage)
  storage.setItem(REVIEW_KEY, JSON.stringify([{ quoteNo: state.quoteNo, version: 1, submittedBy: 'staff', submittedAt: '2026-10-21T00:00:00.000Z', status: 'pending' }]))
  storage.setItem(OWNER_KEY, JSON.stringify({ [state.quoteNo]: 'staff' }))
  storage.setItem('smartquote-pro:staff', 'never export passwords')
  storage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ [`${state.quoteNo}::new::`]: {
    step: 'addons', visited: ['location', 'configuration', 'product', 'measurements', 'addons'],
    draft: { ...emptyItemDraft(), location: 'Unfinished opening', photos: state.items[0].photos },
    markers: {}, strokes: [], updatedAt: 1,
  } }))
  return createQuoteBackup(state, storage, async () => ({ [`${state.quoteNo}:v1`]: state.roomPhotos }))
}

describe('quote backup and restore', () => {
  it('retains percentage discounts and notes when restoring a backup and rejects invalid discounts', async () => {
    const data = await backup()
    const discount = { percent: 12.5, note: 'Pensioner discount' }
    data.archives[0].quote.discount = discount
    data.archives[0].total = 96.25
    data.drafts[0].discount = discount
    const target = new MemoryStorage()
    await restoreQuoteBackup(parseQuoteBackup(JSON.stringify(data)), () => false, target, photoStore())
    expect(JSON.parse(target.getItem(ARCHIVE_KEY)!)[0].quote.discount).toEqual(discount)
    expect(JSON.parse(target.getItem(quoteDraftKey('BACKUP-1', 1))!).discount).toEqual(discount)
    data.archives[0].quote.discount = { percent: 101, note: '' }
    expect(() => parseQuoteBackup(JSON.stringify(data))).toThrow()
  })
  it('round-trips quote versions, drafts, reviews and both kinds of photos without login data', async () => {
    const data = await backup()
    const target = new MemoryStorage()
    const photos = photoStore()
    const result = await restoreQuoteBackup(parseQuoteBackup(JSON.stringify(data)), () => false, target, photos)
    expect(result.archives).toHaveLength(1)
    expect(result.drafts).toHaveLength(1)
    expect(JSON.parse(target.getItem(ARCHIVE_KEY)!)[0].quote).toEqual(quote())
    expect(JSON.parse(target.getItem(quoteDraftKey('BACKUP-1', 1))!).items[0].photos[0].dataUrl).toBe(image)
    expect((await photos.read())['BACKUP-1:v1'].Living[0].dataUrl).toBe(image)
    expect(JSON.parse(target.getItem(REVIEW_KEY)!)[0].submittedBy).toBe('staff')
    expect(JSON.parse(target.getItem(OWNER_KEY)!)).toEqual({ 'BACKUP-1': 'staff' })
    expect(JSON.stringify(data)).not.toContain('never export passwords')
    expect(loadWizardDraft({ quoteNo: 'BACKUP-1', kind: 'new', refId: null }, target)?.draft.location).toBe('Unfinished opening')
    expect(loadWizardDraft({ quoteNo: 'BACKUP-1', kind: 'new', refId: null }, target)?.draft.photos[0].dataUrl).toBe(image)
  })

  it('skips existing versions and drafts on repeated import without overwriting local edits', async () => {
    const data = await backup()
    const storage = new MemoryStorage()
    const photos = photoStore()
    await restoreQuoteBackup(data, () => false, storage, photos)
    const existing = JSON.parse(storage.getItem(ARCHIVE_KEY)!)
    existing[0].quote.customer.name = 'Keep local edits'
    storage.setItem(ARCHIVE_KEY, JSON.stringify(existing))
    const before = storage.getItem(ARCHIVE_KEY)
    expect(planQuoteRestore(data, storage).skipped).toBe(2)
    const result = await restoreQuoteBackup(data, () => false, storage, photos)
    expect(result.archives).toHaveLength(0)
    expect(storage.getItem(ARCHIVE_KEY)).toBe(before)
  })

  it('rolls back photo additions and local records if a storage write fails', async () => {
    const data = await backup()
    const storage = new MemoryStorage()
    const photos = photoStore({ unrelated: { Other: [{ id: 'keep', dataUrl: image, caption: 'Keep' }] } })
    const before = await photos.read()
    storage.failWrites = true
    await expect(restoreQuoteBackup(data, () => false, storage, photos)).rejects.toThrow()
    expect(storage.length).toBe(0)
    expect(await photos.read()).toEqual(before)
  })

  it('rejects unsupported, malformed or negative-price backups before making changes', async () => {
    const data = await backup()
    expect(() => parseQuoteBackup('broken')).toThrow(/JSON/)
    expect(() => parseQuoteBackup(JSON.stringify({ ...data, schemaVersion: 999 }))).toThrow(/Unsupported/)
    data.archives[0].quote.items[0].unitPrice = -1
    expect(() => parseQuoteBackup(JSON.stringify(data))).toThrow(/Invalid/)
  })

  it('does not replace an unreadable existing archive with an apparently empty one', async () => {
    const data = await backup()
    const storage = new MemoryStorage()
    storage.setItem(ARCHIVE_KEY, 'damaged original')
    expect(() => upsertArchivedQuote(quote(), { total: 110 }, storage)).toThrow(/preserved/)
    expect(storage.getItem(ARCHIVE_KEY)).toBe('damaged original')
    expect(() => planQuoteRestore(data, storage)).toThrow()
  })

  it('keeps each tab on its own quote when another tab updates the legacy current draft', () => {
    const storage = new MemoryStorage()
    const tabA = new MemoryStorage()
    const tabB = new MemoryStorage()
    const a = quote()
    const b = { ...quote(), quoteNo: 'BACKUP-2', quoteNumber: 'BACKUP-2' }
    persistDraftQuote(a, storage, { scoped: true })
    persistDraftQuote(b, storage, { scoped: true })
    tabA.setItem('smartquote-pro:active-quote', JSON.stringify([a.quoteNo, a.version]))
    tabB.setItem('smartquote-pro:active-quote', JSON.stringify([b.quoteNo, b.version]))
    expect(JSON.parse(readTabDraft(storage, tabA)!).quoteNo).toBe(a.quoteNo)
    expect(JSON.parse(readTabDraft(storage, tabB)!).quoteNo).toBe(b.quoteNo)
    expect(JSON.parse(storage.getItem(DRAFT_STORAGE_KEY)!).quoteNo).toBe(b.quoteNo)
  })
})

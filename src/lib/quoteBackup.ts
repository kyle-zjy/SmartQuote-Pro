import { workspaceStorage } from './workspaceStorage'
import { isValidQuoteDiscount } from './quoteDiscount'
import { money } from './quoteTotals'
import { normalizeQuote, type QuoteState, type RoomPhoto } from './quoteContext'
import { ARCHIVE_KEY, type ArchivedQuote } from './quoteArchive'
import { DRAFT_STORAGE_KEY, QUOTE_DRAFT_PREFIX, quoteDraftKey, stripRoomPhotoData } from './quotePersist'
import { OWNER_KEY, REVIEW_KEY, type ReviewRecord } from './reviewStore'
import { readPhotoEntries, writePhotoEntries } from './quotePhotoStore'
import { withStorageRollback } from './storageTransaction'
import { quoteEditLockName, withQuoteStorageLock } from './quoteWriteLock'
import { WIZARD_STORAGE_KEY, type WizardDraftSnapshot } from '../pages/quote-item/wizardDraftStore'
import { COMPANY } from '../data/company'
import { emptyItemDraft } from '../pages/quote-item/itemDraft'

type PhotoEntries = Record<string, Record<string, RoomPhoto[]>>
export interface QuoteBackup {
  format: 'smartquote-pro-backup'
  schemaVersion: 1
  createdAt: string
  archives: ArchivedQuote[]
  drafts: QuoteState[]
  reviews: ReviewRecord[]
  owners: Record<string, string>
  roomPhotos: PhotoEntries
  wizardDrafts: Record<string, WizardDraftSnapshot>
}

function object(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 }
function assert(condition: unknown, message = 'Invalid backup data. Nothing was restored.'): asserts condition { if (!condition) throw new Error(message) }
function validatePhotos(value: unknown) {
  assert(object(value))
  for (const photos of Object.values(value)) {
    assert(Array.isArray(photos))
    for (const photo of photos) assert(object(photo) && typeof photo.id === 'string' && typeof photo.caption === 'string' && typeof photo.dataUrl === 'string' && (!photo.dataUrl || photo.dataUrl.startsWith('data:image/')))
  }
}
function validateStrokes(value: unknown) {
  assert(Array.isArray(value))
  for (const stroke of value) assert(object(stroke) && typeof stroke.color === 'string' && finite(stroke.size) && typeof stroke.erase === 'boolean' &&
    Array.isArray(stroke.points) && stroke.points.every((point: unknown) => object(point) && finite(point.x) && finite(point.y)))
}
function validateQuote(value: unknown): asserts value is QuoteState {
  assert(object(value) && typeof value.quoteNo === 'string' && value.quoteNo.length > 0 && value.quoteNo.length <= 50 &&
    Number.isSafeInteger(value.version) && Number(value.version) >= 1 && Array.isArray(value.items) &&
    ['draft', 'office-review', 'issued'].includes(String(value.status)) && typeof value.gstEnabled === 'boolean' &&
    object(value.customer) && typeof value.customer.name === 'string' && typeof value.customer.address === 'string' && typeof value.customer.phone === 'string' &&
    object(value.shipTo) && typeof value.shipTo.name === 'string' && typeof value.shipTo.address === 'string' && typeof value.shipTo.phone === 'string' &&
    typeof value.shipSameAsBill === 'boolean' && typeof value.quoteNumber === 'string' && typeof value.quoteDate === 'string' &&
    typeof value.frameColour === 'string' && typeof value.customFrameColour === 'string' && finite(value.paid) &&
    (value.colourExtraOverride === null || finite(value.colourExtraOverride)))
  assert(value.discount === undefined || isValidQuoteDiscount(value.discount))
  for (const item of value.items) {
    assert(object(item) && typeof item.id === 'string' && typeof item.description === 'string' && typeof item.detail === 'string' &&
      typeof item.room === 'string' && typeof item.note === 'string' && finite(item.unitPrice) &&
      typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) && item.quantity > 0)
    for (const key of ['finalPrice', 'calculatedPrice'] as const) assert(item[key] === undefined || finite(item[key]))
    for (const key of ['addons', 'fitExtraPrices'] as const) {
      assert(item[key] === undefined || (Array.isArray(item[key]) && item[key].every((addon: unknown) => object(addon) && typeof addon.name === 'string' && finite(addon.price))))
    }
    if (item.photos !== undefined) {
      assert(Array.isArray(item.photos))
      for (const photo of item.photos) {
        assert(object(photo) && typeof photo.id === 'string' && typeof photo.dataUrl === 'string' &&
          (!photo.dataUrl || photo.dataUrl.startsWith('data:image/')) &&
          (photo.annotatedDataUrl === null || (typeof photo.annotatedDataUrl === 'string' && photo.annotatedDataUrl.startsWith('data:image/'))))
        validateStrokes(photo.strokes)
      }
    }
  }
  validatePhotos(value.roomPhotos)
  if (value.status === 'issued') {
    assert(object(value.issuedSnapshot))
    for (const field of ['colourExtra', 'depositRate', 'subtotal', 'gstAmount', 'total', 'deposit']) assert(finite(value.issuedSnapshot[field]))
    assert(typeof value.issuedSnapshot.issuedAt === 'string')
    const discount = value.issuedSnapshot.discount
    if (discount !== undefined || value.discount !== undefined) {
      assert(object(discount) && isValidQuoteDiscount(discount) && isValidQuoteDiscount(value.discount))
      assert(discount.percent === value.discount.percent && discount.note === value.discount.note &&
        finite(discount.amount) && finite(discount.subtotalBeforeDiscount))
      assert(discount.amount === money(discount.subtotalBeforeDiscount * discount.percent / 100) &&
        value.issuedSnapshot.subtotal === money(discount.subtotalBeforeDiscount - discount.amount))
    }
    const document = value.issuedSnapshot.document
    if (document !== undefined) {
      assert(object(document) && object(document.company) && object(document.company.bank) &&
        Array.isArray(document.warrantyNotes) && document.warrantyNotes.every((note: unknown) => typeof note === 'string'))
      for (const [key, example] of Object.entries(COMPANY)) {
        if (key !== 'bank') assert(typeof document.company[key] === typeof example && (typeof example !== 'number' || finite(document.company[key])))
      }
      for (const key of Object.keys(COMPANY.bank)) assert(typeof document.company.bank[key] === 'string')
    }
  }
}

export function parseQuoteBackup(text: string): QuoteBackup {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('This file is not valid JSON. Nothing was restored.') }
  assert(object(data) && data.format === 'smartquote-pro-backup' && data.schemaVersion === 1, 'Unsupported backup format or version. Nothing was restored.')
  assert(typeof data.createdAt === 'string' && Number.isFinite(Date.parse(data.createdAt)) && Array.isArray(data.archives) && Array.isArray(data.drafts) && Array.isArray(data.reviews) && object(data.owners) && object(data.roomPhotos))
  const seen = new Set<string>()
  for (const record of data.archives) {
    assert(object(record))
    validateQuote(record.quote)
    const key = quoteDraftKey(record.quote.quoteNo, record.quote.version)
    assert(record.quoteNo === record.quote.quoteNo && record.version === record.quote.version && !seen.has(key) && finite(record.total) && finite(record.itemCount) && typeof record.savedAt === 'string' && Array.isArray(record.comments))
    for (const comment of record.comments) assert(object(comment) && typeof comment.id === 'string' && typeof comment.text === 'string' && typeof comment.createdAt === 'string')
    seen.add(key)
  }
  const draftKeys = new Set<string>()
  for (const draft of data.drafts) {
    validateQuote(draft)
    const key = quoteDraftKey(draft.quoteNo, draft.version)
    assert(!draftKeys.has(key))
    draftKeys.add(key)
  }
  const quoteNos = new Set([...data.archives.map((record) => record.quoteNo), ...data.drafts.map((draft) => draft.quoteNo)])
  for (const review of data.reviews) assert(object(review) && typeof review.quoteNo === 'string' && quoteNos.has(review.quoteNo) &&
    Number.isSafeInteger(review.version) && Number(review.version) >= 1 && typeof review.submittedBy === 'string' && typeof review.submittedAt === 'string' &&
    ['pending', 'approved', 'returned'].includes(String(review.status)) && (review.contentKey === undefined || typeof review.contentKey === 'string') &&
    (review.reviewNote === undefined || typeof review.reviewNote === 'string'))
  for (const [no, owner] of Object.entries(data.owners)) assert(quoteNos.has(no) && typeof owner === 'string')
  for (const photos of Object.values(data.roomPhotos)) validatePhotos(photos)
  if (data.wizardDrafts === undefined) data.wizardDrafts = {}
  assert(object(data.wizardDrafts))
  for (const [key, snapshot] of Object.entries(data.wizardDrafts)) {
    assert([...quoteNos].some((no) => key.startsWith(`${no}::`)) && object(snapshot) && finite(snapshot.updatedAt) &&
      typeof snapshot.step === 'string' && ['location', 'configuration', 'product', 'measurements', 'addons', 'review'].includes(snapshot.step) &&
      Array.isArray(snapshot.visited) && object(snapshot.draft) && typeof snapshot.draft.location === 'string' && Array.isArray(snapshot.draft.addons) &&
      Array.isArray(snapshot.draft.photos) && object(snapshot.markers) && Array.isArray(snapshot.strokes))
    const draft = { ...emptyItemDraft(), ...snapshot.draft }
    for (const [field, example] of Object.entries(emptyItemDraft())) {
      if (typeof example === 'string' || typeof example === 'boolean') assert(typeof draft[field as keyof typeof draft] === typeof example)
      if (Array.isArray(example)) assert(Array.isArray(draft[field as keyof typeof draft]))
    }
    assert(Number.isSafeInteger(draft.quantity) && draft.quantity > 0 && object(draft.measurements) && Object.values(draft.measurements).every((entry) => typeof entry === 'string'))
    validateStrokes(snapshot.strokes)
    for (const marker of Object.values(snapshot.markers)) assert(object(marker) && finite(marker.x) && finite(marker.y))
    snapshot.draft = draft
  }
  return data as unknown as QuoteBackup
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  const raw = storage.getItem(key)
  try { return raw === null ? fallback : JSON.parse(raw) as T }
  catch { throw new Error(`Stored quote data is damaged (${key}). Export a recovery copy before changing it.`) }
}

export function localQuoteDrafts(storage: Storage = workspaceStorage): QuoteState[] {
  const drafts = new Map<string, QuoteState>()
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(QUOTE_DRAFT_PREFIX)))
  for (const key of [...keys, DRAFT_STORAGE_KEY]) {
    const stored = readJson<QuoteState | null>(storage, key, null)
    if (!stored) continue
    assert(typeof stored.quoteNo === 'string' && stored.quoteNo && Array.isArray(stored.items))
    const quote = normalizeQuote(stored, stored.quoteNo)
    validateQuote(quote)
    if (quote.items.length || quote.customer.name.trim()) drafts.set(quoteDraftKey(quote.quoteNo, quote.version), quote)
  }
  return [...drafts.values()]
}

export async function createQuoteBackup(current?: QuoteState, storage: Storage = workspaceStorage, readPhotos = readPhotoEntries): Promise<QuoteBackup> {
  return withQuoteStorageLock(async () => {
    const drafts = localQuoteDrafts(storage)
    if (current && (current.items.length || current.customer.name.trim())) {
      const clean = { ...normalizeQuote(current, current.quoteNo), quoteNumber: current.quoteNumber }
      const index = drafts.findIndex((quote) => quote.quoteNo === current.quoteNo && quote.version === current.version)
      if (index < 0) drafts.push(clean)
      else drafts[index] = clean
    }
    const archives = readJson<ArchivedQuote[]>(storage, ARCHIVE_KEY, []).map((record) => {
      assert(object(record) && object(record.quote) && typeof record.quoteNo === 'string' && Array.isArray(record.quote.items))
      const quote = normalizeQuote(record.quote, record.quoteNo)
      return { ...record, version: quote.version, quote, comments: record.comments ?? [] }
    })
    const quoteNos = new Set([...archives.map((record) => record.quoteNo), ...drafts.map((quote) => quote.quoteNo)])
    const roomPhotos = await readPhotos()
    for (const quote of [...archives.map((record) => record.quote), ...drafts]) {
      const key = `${quote.quoteNo}:v${quote.version}`
      if (!roomPhotos[key] && quote.version === 1 && roomPhotos[quote.quoteNo]) roomPhotos[key] = roomPhotos[quote.quoteNo]
    }
    if (current && Object.values(current.roomPhotos).some((photos) => photos.length > 0)) roomPhotos[`${current.quoteNo}:v${current.version}`] = current.roomPhotos
    const backup: QuoteBackup = {
      format: 'smartquote-pro-backup', schemaVersion: 1, createdAt: new Date().toISOString(), archives, drafts,
      reviews: readJson<ReviewRecord[]>(storage, REVIEW_KEY, []).filter((review) => quoteNos.has(review.quoteNo)),
      owners: Object.fromEntries(Object.entries(readJson<Record<string, string>>(storage, OWNER_KEY, {})).filter(([no]) => quoteNos.has(no))),
      roomPhotos,
      wizardDrafts: Object.fromEntries(Object.entries(readJson<Record<string, WizardDraftSnapshot>>(storage, WIZARD_STORAGE_KEY, {})).filter(([key]) => [...quoteNos].some((no) => key.startsWith(`${no}::`)))),
    }
    return parseQuoteBackup(JSON.stringify(backup))
  })
}

export interface RestorePlan { archives: ArchivedQuote[]; drafts: QuoteState[]; skipped: number }
export function planQuoteRestore(backup: QuoteBackup, storage: Storage = workspaceStorage): RestorePlan {
  const existing = readJson<ArchivedQuote[]>(storage, ARCHIVE_KEY, [])
  assert(Array.isArray(existing), 'Stored archive is damaged. Nothing was restored.')
  for (const record of existing) { validateQuote(record.quote); assert(record.quoteNo === record.quote.quoteNo && record.version === record.quote.version) }
  const archiveKeys = new Set(existing.map((record) => quoteDraftKey(record.quoteNo, record.version)))
  const archives = backup.archives.filter((record) => !archiveKeys.has(quoteDraftKey(record.quoteNo, record.version)))
  const drafts = backup.drafts.filter((quote) => {
    const raw = storage.getItem(quoteDraftKey(quote.quoteNo, quote.version))
    if (!raw) {
      const legacy = readJson<QuoteState | null>(storage, DRAFT_STORAGE_KEY, null)
      return !legacy || legacy.quoteNo !== quote.quoteNo || legacy.version !== quote.version || (!legacy.items.length && !legacy.customer.name.trim())
    }
    const old = readJson<QuoteState>(storage, quoteDraftKey(quote.quoteNo, quote.version), quote)
    return old.items.length === 0 && !old.customer.name.trim()
  })
  return { archives, drafts, skipped: backup.archives.length + backup.drafts.length - archives.length - drafts.length }
}

async function withFamilies<T>(families: string[], owns: (no: string) => boolean, write: () => Promise<T>): Promise<T> {
  const [no, ...rest] = families
  if (!no) return write()
  if (owns(no) || typeof window === 'undefined') return withFamilies(rest, owns, write)
  return navigator.locks.request(quoteEditLockName(no), { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error(`Quote ${no} is open in another tab. Close it there before restoring.`)
    return withFamilies(rest, owns, write)
  })
}

export async function restoreQuoteBackup(
  backup: QuoteBackup,
  owns: (no: string) => boolean,
  storage: Storage = workspaceStorage,
  photos = { read: readPhotoEntries, write: writePhotoEntries },
): Promise<RestorePlan> {
  // Validate again at the write boundary, including callers other than the file picker.
  const valid = parseQuoteBackup(JSON.stringify(backup))
  return withQuoteStorageLock(async () => {
    const plan = planQuoteRestore(valid, storage)
    const families = [...new Set([...plan.archives.map((record) => record.quoteNo), ...plan.drafts.map((quote) => quote.quoteNo)])].sort()
    return withFamilies(families, owns, async () => {
      const eligible = new Set([...plan.archives.map((record) => `${record.quoteNo}:v${record.version}`), ...plan.drafts.map((quote) => `${quote.quoteNo}:v${quote.version}`)])
      const beforePhotos = await photos.read()
      const additions = Object.fromEntries(Object.entries(valid.roomPhotos).filter(([key]) => eligible.has(key)))
      const updates: PhotoEntries = {}
      for (const [key, rooms] of Object.entries(additions)) {
        updates[key] = { ...beforePhotos[key] }
        for (const [room, incoming] of Object.entries(rooms)) {
          const previous = beforePhotos[key]?.[room] ?? []
          const merged = new Map(previous.map((photo) => [photo.id, photo]))
          for (const photo of incoming) if (!merged.get(photo.id)?.dataUrl) merged.set(photo.id, photo)
          updates[key][room] = [...merged.values()]
        }
      }
      const keys = [ARCHIVE_KEY, REVIEW_KEY, OWNER_KEY, WIZARD_STORAGE_KEY, ...plan.drafts.map((quote) => quoteDraftKey(quote.quoteNo, quote.version))]
      await photos.write(updates)
      try {
        withStorageRollback(storage, keys, () => {
          const existing = readJson<ArchivedQuote[]>(storage, ARCHIVE_KEY, [])
          storage.setItem(ARCHIVE_KEY, JSON.stringify([...plan.archives, ...existing]))
          for (const draft of plan.drafts) storage.setItem(quoteDraftKey(draft.quoteNo, draft.version), JSON.stringify(stripRoomPhotoData(draft)))
          const added = new Set(plan.archives.map((record) => quoteDraftKey(record.quoteNo, record.version)))
          const reviews = readJson<ReviewRecord[]>(storage, REVIEW_KEY, [])
          const reviewKeys = new Set(reviews.map((review) => quoteDraftKey(review.quoteNo, review.version)))
          storage.setItem(REVIEW_KEY, JSON.stringify([...valid.reviews.filter((review) => added.has(quoteDraftKey(review.quoteNo, review.version)) && !reviewKeys.has(quoteDraftKey(review.quoteNo, review.version))), ...reviews]))
          const existingOwners = readJson<Record<string, string>>(storage, OWNER_KEY, {})
          const importedOwners = Object.fromEntries(Object.entries(valid.owners).filter(([no]) => families.includes(no)))
          storage.setItem(OWNER_KEY, JSON.stringify({ ...importedOwners, ...existingOwners }))
          const existingWizards = readJson<Record<string, WizardDraftSnapshot>>(storage, WIZARD_STORAGE_KEY, {})
          const importedWizards = Object.fromEntries(Object.entries(valid.wizardDrafts).filter(([key]) => families.some((no) => key.startsWith(`${no}::`)))
            .map(([key, snapshot]) => [key, { ...snapshot, updatedAt: Date.now() }]))
          storage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ ...importedWizards, ...existingWizards }))
        })
      } catch (error) {
        try { await photos.write(Object.fromEntries(Object.keys(updates).map((key) => [key, beforePhotos[key] ?? null]))) }
        catch { throw new Error('Restore failed and photo rollback could not finish. Keep this backup file and retry when storage is available.') }
        throw error
      }
      return plan
    })
  }, true)
}

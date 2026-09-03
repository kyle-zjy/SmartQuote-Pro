import { parseDealStatus, type DealStatus } from './quoteLifecycle'
import type { QuoteState } from './quoteContext'

export const ARCHIVE_KEY = 'smartquote-pro:archive'

export interface RevisionComment {
  id: string
  text: string
  createdAt: string
}

export interface ArchivedQuote {
  quoteNo: string
  version: number
  savedAt: string
  quote: QuoteState
  total: number
  itemCount: number
  photosOmitted: boolean
  comments: RevisionComment[]
}

export interface ArchiveWriteResult {
  record: ArchivedQuote
  photosOmitted: boolean
}

export interface ArchivedQuoteGroup {
  quoteNo: string
  versions: ArchivedQuote[]
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export function recordVersion(record: Pick<ArchivedQuote, 'version' | 'quote'>): number {
  return Math.max(1, record.version || record.quote.version || 1)
}

function normalizeRecord(record: ArchivedQuote): ArchivedQuote {
  const version = recordVersion(record)
  const dealStatus = parseDealStatus(record.quote?.dealStatus)
  return {
    ...record,
    version,
    comments: Array.isArray(record.comments) ? record.comments : [],
    quote: { ...record.quote, version: record.quote.version || version, dealStatus },
  }
}

function readArchive(storage: Storage): ArchivedQuote[] {
  try {
    const raw = storage.getItem(ARCHIVE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ArchivedQuote[]
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : []
  } catch {
    return []
  }
}

function writeArchive(storage: Storage, records: ArchivedQuote[]): void {
  storage.setItem(ARCHIVE_KEY, JSON.stringify(records))
}

function withoutPhotos(quote: QuoteState): QuoteState {
  return {
    ...quote,
    roomPhotos: {},
    items: quote.items.map((item) =>
      item.photos
        ? { ...item, photos: item.photos.map((photo) => ({ ...photo, dataUrl: '', annotatedDataUrl: null })) }
        : item,
    ),
  }
}

export function listArchivedQuotes(storage: Storage = localStorage): ArchivedQuote[] {
  return [...readArchive(storage)].sort((a, b) => {
    if (a.quoteNo !== b.quoteNo) return b.quoteNo.localeCompare(a.quoteNo)
    if (a.version !== b.version) return b.version - a.version
    return b.savedAt.localeCompare(a.savedAt)
  })
}

export function groupArchivedQuotes(records: ArchivedQuote[]): ArchivedQuoteGroup[] {
  const groups = new Map<string, ArchivedQuote[]>()
  for (const record of records) {
    const current = groups.get(record.quoteNo) ?? []
    current.push(record)
    groups.set(record.quoteNo, current)
  }
  return [...groups.entries()].map(([quoteNo, versions]) => ({
    quoteNo,
    versions: [...versions].sort((a, b) => b.version - a.version),
  }))
}

export function groupDealStatus(group: ArchivedQuoteGroup): DealStatus {
  return parseDealStatus(group.versions[0]?.quote.dealStatus)
}

export function partitionArchivedQuoteGroups(records: ArchivedQuote[]): Record<DealStatus, ArchivedQuoteGroup[]> {
  const partitioned: Record<DealStatus, ArchivedQuoteGroup[]> = {
    open: [],
    abandoned: [],
    closed: [],
  }
  for (const group of groupArchivedQuotes(records)) {
    partitioned[groupDealStatus(group)].push(group)
  }
  return partitioned
}

export function getArchivedQuote(
  quoteNo: string,
  version?: number,
  storage: Storage = localStorage,
): ArchivedQuote | undefined {
  const matches = readArchive(storage).filter((record) => record.quoteNo === quoteNo)
  if (version !== undefined) return matches.find((record) => record.version === version)
  return [...matches].sort((a, b) => b.version - a.version)[0]
}

export function upsertArchivedQuote(
  quote: QuoteState,
  totals: { total: number },
  storage: Storage = localStorage,
): ArchiveWriteResult {
  const version = Math.max(1, quote.version || 1)
  const itemCount = quote.items.reduce((sum, item) => sum + item.quantity, 0)
  const records = readArchive(storage)
  const previous = records.find((record) => record.quoteNo === quote.quoteNo && record.version === version)
  const existing = records.filter((record) => !(record.quoteNo === quote.quoteNo && record.version === version))
  const withPhotos: ArchivedQuote = {
    quoteNo: quote.quoteNo,
    version,
    savedAt: new Date().toISOString(),
    quote: { ...quote, version },
    total: totals.total,
    itemCount,
    photosOmitted: false,
    comments: previous?.comments ?? [],
  }

  try {
    writeArchive(storage, [withPhotos, ...existing])
    return { record: withPhotos, photosOmitted: false }
  } catch (error) {
    if (!isQuotaError(error)) throw error
  }

  const stripped: ArchivedQuote = {
    ...withPhotos,
    quote: withoutPhotos(withPhotos.quote),
    photosOmitted: true,
  }
  writeArchive(storage, [stripped, ...existing])
  return { record: stripped, photosOmitted: true }
}

export function deleteArchivedQuote(quoteNo: string, version: number, storage: Storage = localStorage): void {
  writeArchive(
    storage,
    readArchive(storage).filter((record) => !(record.quoteNo === quoteNo && record.version === version)),
  )
}

export function addArchivedQuoteComment(
  quoteNo: string,
  version: number,
  text: string,
  storage: Storage = localStorage,
): RevisionComment | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const comment: RevisionComment = {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt: new Date().toISOString(),
  }
  let found = false
  const next = readArchive(storage).map((record) => {
    if (record.quoteNo !== quoteNo || record.version !== version) return record
    found = true
    return { ...record, comments: [...record.comments, comment] }
  })
  if (!found) return null
  writeArchive(storage, next)
  return comment
}

export function setArchivedQuoteDealStatus(
  quoteNo: string,
  dealStatus: DealStatus,
  storage: Storage = localStorage,
): void {
  writeArchive(
    storage,
    readArchive(storage).map((record) =>
      record.quoteNo === quoteNo ? { ...record, quote: { ...record.quote, dealStatus } } : record,
    ),
  )
}

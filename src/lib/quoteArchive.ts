import type { QuoteState } from './quoteContext'

export const ARCHIVE_KEY = 'smartquote-pro:archive'

export interface ArchivedQuote {
  quoteNo: string
  savedAt: string
  quote: QuoteState
  total: number
  itemCount: number
  photosOmitted: boolean
}

export interface ArchiveWriteResult {
  record: ArchivedQuote
  photosOmitted: boolean
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

function readArchive(storage: Storage): ArchivedQuote[] {
  try {
    const raw = storage.getItem(ARCHIVE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ArchivedQuote[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeArchive(storage: Storage, records: ArchivedQuote[]): void {
  storage.setItem(ARCHIVE_KEY, JSON.stringify(records))
}

function withoutPhotos(quote: QuoteState): QuoteState {
  return { ...quote, roomPhotos: {} }
}

export function listArchivedQuotes(storage: Storage = localStorage): ArchivedQuote[] {
  return [...readArchive(storage)].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getArchivedQuote(quoteNo: string, storage: Storage = localStorage): ArchivedQuote | undefined {
  return readArchive(storage).find((record) => record.quoteNo === quoteNo)
}

export function upsertArchivedQuote(
  quote: QuoteState,
  totals: { total: number },
  storage: Storage = localStorage,
): ArchiveWriteResult {
  const itemCount = quote.items.reduce((sum, item) => sum + item.quantity, 0)
  const existing = readArchive(storage).filter((record) => record.quoteNo !== quote.quoteNo)
  const withPhotos: ArchivedQuote = {
    quoteNo: quote.quoteNo,
    savedAt: new Date().toISOString(),
    quote,
    total: totals.total,
    itemCount,
    photosOmitted: false,
  }

  try {
    writeArchive(storage, [withPhotos, ...existing])
    return { record: withPhotos, photosOmitted: false }
  } catch (error) {
    if (!isQuotaError(error)) throw error
  }

  const stripped: ArchivedQuote = {
    ...withPhotos,
    quote: withoutPhotos(quote),
    photosOmitted: true,
  }
  writeArchive(storage, [stripped, ...existing])
  return { record: stripped, photosOmitted: true }
}

export function deleteArchivedQuote(quoteNo: string, storage: Storage = localStorage): void {
  writeArchive(
    storage,
    readArchive(storage).filter((record) => record.quoteNo !== quoteNo),
  )
}

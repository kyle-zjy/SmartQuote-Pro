import { describe, expect, it } from 'vitest'
import type { QuoteState } from './quoteContext'
import { ARCHIVE_KEY, deleteArchivedQuote, listArchivedQuotes, upsertArchivedQuote } from './quoteArchive'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

function sampleQuote(quoteNo: string, name: string): QuoteState {
  return {
    items: [{ id: '1', description: 'Door', detail: '', quantity: 1, unitPrice: 100, room: 'Lounge', note: '' }],
    gstEnabled: true,
    roomPhotos: {},
    customer: { name, address: '1 Test St', phone: '0400000000' },
    shipSameAsBill: true,
    shipTo: { name: '', address: '', phone: '' },
    quoteNo,
    quoteSuffix: 'SS',
    quoteDate: '2026-08-23',
    frameColour: 'White',
    customFrameColour: '',
    colourExtraOverride: null,
    paid: 0,
    status: 'draft',
    issuedSnapshot: null,
  }
}

describe('quoteArchive', () => {
  it('saves a quote and lists newest first', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada'), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033022', 'Ben'), { total: 220 }, storage)

    const listed = listArchivedQuotes(storage)
    expect(listed.map((record) => record.quoteNo)).toEqual(['00033022', '00033021'])
    expect(listed[0]?.quote.customer.name).toBe('Ben')
  })

  it('replaces an existing quote with the same number', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada'), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033021', 'Ada Updated'), { total: 330 }, storage)

    const listed = listArchivedQuotes(storage)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.quote.customer.name).toBe('Ada Updated')
    expect(listed[0]?.total).toBe(330)
  })

  it('deletes a saved quote', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada'), { total: 110 }, storage)
    deleteArchivedQuote('00033021', storage)
    expect(listArchivedQuotes(storage)).toEqual([])
    expect(storage.getItem(ARCHIVE_KEY)).toBe('[]')
  })
})

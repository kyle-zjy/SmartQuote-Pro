import { describe, expect, it } from 'vitest'
import type { QuoteState } from './quoteContext'
import {
  ARCHIVE_KEY,
  addArchivedQuoteComment,
  deleteArchivedQuote,
  getArchivedQuote,
  groupArchivedQuotes,
  listArchivedQuotes,
  partitionArchivedQuoteGroups,
  setArchivedQuoteDealStatus,
  upsertArchivedQuote,
} from './quoteArchive'

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

function sampleQuote(quoteNo: string, name: string, version = 1): QuoteState {
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
    version,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
  }
}

describe('quoteArchive', () => {
  it('saves a quote and lists newest quote numbers first', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada'), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033022', 'Ben'), { total: 220 }, storage)

    const listed = listArchivedQuotes(storage)
    expect(listed.map((record) => record.quoteNo)).toEqual(['00033022', '00033021'])
    expect(listed[0]?.quote.customer.name).toBe('Ben')
  })

  it('keeps older revisions when the same quote number is saved as a new version', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada', 1), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033021', 'Ada Updated', 2), { total: 330 }, storage)

    const listed = listArchivedQuotes(storage)
    expect(listed).toHaveLength(2)
    expect(getArchivedQuote('00033021', 1, storage)?.quote.customer.name).toBe('Ada')
    expect(getArchivedQuote('00033021', undefined, storage)?.version).toBe(2)
    expect(groupArchivedQuotes(listed)[0]?.versions.map((record) => record.version)).toEqual([2, 1])
  })

  it('replaces an existing revision with the same number and version', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada', 1), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033021', 'Ada Updated', 1), { total: 330 }, storage)

    const listed = listArchivedQuotes(storage)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.quote.customer.name).toBe('Ada Updated')
    expect(listed[0]?.total).toBe(330)
  })

  it('deletes one revision without removing the others', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada', 1), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033021', 'Ada v2', 2), { total: 220 }, storage)
    deleteArchivedQuote('00033021', 1, storage)
    expect(listArchivedQuotes(storage)).toHaveLength(1)
    expect(listArchivedQuotes(storage)[0]?.version).toBe(2)
    expect(storage.getItem(ARCHIVE_KEY)).toContain('Ada v2')
  })

  it('stores comments on a revision and keeps them when the quote is saved again', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada', 2), { total: 220 }, storage)
    const comment = addArchivedQuoteComment('00033021', 2, 'Customer asked for a lock post', storage)
    expect(comment?.text).toBe('Customer asked for a lock post')

    upsertArchivedQuote(sampleQuote('00033021', 'Ada v2', 2), { total: 280 }, storage)
    const record = getArchivedQuote('00033021', 2, storage)
    expect(record?.total).toBe(280)
    expect(record?.comments.map((item) => item.text)).toEqual(['Customer asked for a lock post'])
  })

  it('treats quotes without a deal status as in progress', () => {
    const storage = new MemoryStorage()
    const quote = sampleQuote('00033021', 'Ada')
    delete (quote as { dealStatus?: QuoteState['dealStatus'] }).dealStatus
    upsertArchivedQuote(quote, { total: 110 }, storage)

    const boards = partitionArchivedQuoteGroups(listArchivedQuotes(storage))
    expect(boards.open).toHaveLength(1)
    expect(boards.abandoned).toHaveLength(0)
    expect(boards.closed).toHaveLength(0)
  })

  it('moves every revision of a quote number when the deal status changes', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('00033021', 'Ada', 1), { total: 110 }, storage)
    upsertArchivedQuote(sampleQuote('00033021', 'Ada v2', 2), { total: 220 }, storage)
    upsertArchivedQuote(sampleQuote('00033022', 'Ben'), { total: 330 }, storage)

    setArchivedQuoteDealStatus('00033021', 'closed', storage)

    const boards = partitionArchivedQuoteGroups(listArchivedQuotes(storage))
    expect(boards.closed.map((group) => group.quoteNo)).toEqual(['00033021'])
    expect(boards.closed[0]?.versions).toHaveLength(2)
    expect(boards.open.map((group) => group.quoteNo)).toEqual(['00033022'])
    expect(boards.abandoned).toHaveLength(0)
  })
})

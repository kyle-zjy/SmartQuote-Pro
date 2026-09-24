import { describe, expect, it } from 'vitest'
import type { QuoteState } from './quoteContext'
import { DRAFT_STORAGE_KEY, persistDraftQuote, photoDataChars, stripPhotoData } from './quotePersist'

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

function sampleQuote(): QuoteState {
  const dataUrl = `data:image/png;base64,${'A'.repeat(8000)}`
  return {
    items: [{ id: '1', description: 'Door', detail: '', quantity: 1, unitPrice: 100, room: 'Lounge', note: '' }],
    gstEnabled: true,
    roomPhotos: {
      Lounge: [{ id: 'p1', dataUrl, caption: 'front' }],
    },
    customer: { name: 'Ada', address: '1 Test St', phone: '0400000000' },
    shipSameAsBill: true,
    shipTo: { name: '', address: '', phone: '' },
    quoteNo: '00033021',
    quoteNumber: '',
    quoteDate: '2026-08-23',
    frameColour: 'White',
    customFrameColour: '',
    colourExtraOverride: null,
    paid: 0,
    version: 1,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
  }
}

describe('quotePersist', () => {
  it('counts photo payload without serialising the whole quote', () => {
    const quote = sampleQuote()
    expect(photoDataChars(quote.roomPhotos)).toBe(quote.roomPhotos.Lounge[0].dataUrl.length)
  })

  it('keeps photo ids and captions but drops data URLs from the draft', () => {
    const stripped = stripPhotoData(sampleQuote())
    expect(stripped.roomPhotos.Lounge).toEqual([{ id: 'p1', caption: 'front', dataUrl: '' }])
    expect(stripped.customer.name).toBe('Ada')
  })

  it('writes a draft that is much smaller than the in-memory quote with photos', () => {
    const storage = new MemoryStorage()
    const quote = sampleQuote()
    const fullSize = JSON.stringify(quote).length
    const timings = persistDraftQuote(quote, storage)
    const stored = storage.getItem(DRAFT_STORAGE_KEY) ?? ''

    expect(stored.includes('data:image/png')).toBe(false)
    expect(timings.bytesWritten).toBe(stored.length)
    expect(timings.bytesWritten).toBeLessThan(fullSize / 4)
    expect(JSON.parse(stored).customer.name).toBe('Ada')
  })
})
